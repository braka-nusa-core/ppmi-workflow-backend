import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/services/prisma.service';
import { ClientsService } from '../clients/clients.service';
import {
  ActionNoteDto,
  CreateQuotationDto,
  SendToInsuranceDto,
  UpdateQuotationDto,
} from './quotations.validation';
import {
  REQUIRES_SUPERVISOR_APPROVAL_AFTER_INSURER_REVISION,
  validateTransition,
} from './quotations.constants';

type Actor = { id: string; fullname: string };

type TransitionOptions = {
  approvalAction?: 'APPROVED' | 'REJECTED' | 'REVISION';
  requiresInsurerRevisionEdit?: boolean;
  insurerReviewAction?: 'APPROVED' | 'REVISION';
  insuranceCompanyId?: string;
};

const TECHNICAL_DEPARTMENTS = new Set(['H&M', 'P&I', 'Cargo']);

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
  ) {}

  async list() {
    return this.prisma.quotation.findMany({
      where: { deletedAt: null },
      include: {
        client: { select: { id: true, name: true, clientCode: true } },
        insuranceType: { select: { id: true, code: true, name: true } },
        technicalUnit: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: true,
        insuranceType: true,
        technicalUnit: { select: { id: true, name: true } },
        objects: { where: { deletedAt: null } },
        coverages: { where: { deletedAt: null } },
        terms: {
          where: { deletedAt: null },
          include: { termsCondition: true },
        },
        warranties: {
          where: { deletedAt: null },
          include: { warranty: true },
        },
        attachments: { where: { deletedAt: null } },
        approvals: {
          orderBy: { createdAt: 'desc' },
          include: { approver: { select: { id: true, fullname: true } } },
        },
        histories: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, fullname: true } } },
        },
        submissions: {
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            note: true,
            sentAt: true,
            insuranceCompany: { select: { id: true, code: true, name: true } },
            sentBy: { select: { id: true, fullname: true } },
            reviews: {
              orderBy: { reviewedAt: 'desc' },
              include: {
                recordedBy: { select: { id: true, fullname: true } },
              },
            },
          },
        },
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async generateQuotationNumber(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `QTN-${y}${m}${d}-`;

    const last = await this.prisma.quotation.findFirst({
      where: { quotationNumber: { startsWith: prefix } },
      orderBy: { quotationNumber: 'desc' },
      select: { quotationNumber: true },
    });

    let seq = 1;
    if (last) {
      seq = parseInt(last.quotationNumber.slice(-3), 10) + 1;
    }
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  async create(dto: CreateQuotationDto, actor: Actor) {
    const [quotationNumber, technicalUnitId] = await Promise.all([
      this.generateQuotationNumber(),
      this.getTechnicalUnitId(actor.id),
    ]);

    return this.prisma.$transaction(async (tx) => {
      const insuranceType = await tx.insuranceType.findFirst({
        where: { id: dto.insuranceTypeId, deletedAt: null },
        select: { id: true },
      });
      if (!insuranceType)
        throw new BadRequestException('Insurance type not found');

      let resolvedClientId = dto.clientId;
      if (dto.client) {
        const clientCode = await this.clientsService.generateClientCode();
        const client = await tx.client.create({
          data: {
            clientCode,
            name: dto.client.name,
            address: dto.client.address,
            phone: dto.client.phone,
            email: dto.client.email,
            contactPerson: dto.client.contactPerson,
          },
        });
        resolvedClientId = client.id;

        await tx.log.create({
          data: {
            action: 'CREATE',
            referenceId: client.id,
            referenceType: 'QUOTATION_SLIP',
            userId: actor.id,
            description: `${actor.fullname} created client ${client.name} (${client.clientCode}) via quotation creation`,
          },
        });
      } else {
        const client = await tx.client.findFirst({
          where: { id: resolvedClientId, deletedAt: null },
          select: { id: true },
        });
        if (!client) throw new BadRequestException('Client not found');
      }

      const quotation = await tx.quotation.create({
        data: {
          quotationNumber,
          clientId: resolvedClientId!,
          insuranceTypeId: insuranceType.id,
          technicalUnitId,
          insured: dto.insured,
          address: dto.address,
          quotationDate: dto.quotationDate ? new Date(dto.quotationDate) : null,
          periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
          periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
          interest: dto.interest,
          rate: dto.rate,
          premium: dto.premium,
          deductible: dto.deductible,
          brokerage: dto.brokerage,
          status: 'DRAFT',
          createdById: actor.id,
          templateVersion: dto.templateVersion,
        },
      });

      await tx.quotationHistory.create({
        data: {
          quotationId: quotation.id,
          toStatus: 'DRAFT',
          action: 'CREATE',
          actorId: actor.id,
          note: 'Quotation created',
        },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: quotation.id,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} created quotation ${quotation.quotationNumber}`,
        },
      });

      return quotation;
    });
  }

  async update(id: string, dto: UpdateQuotationDto, actor: Actor) {
    const existing = await this.assertEditable(id, actor.id);
    await this.assertActiveReferences(dto);

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.quotation.updateMany({
        where: { id, deletedAt: null, status: existing.status },
        data: { updatedAt: new Date() },
      });
      if (locked.count !== 1) {
        throw new BadRequestException(
          'Quotation changed concurrently; retry the request',
        );
      }

      const quotation = await tx.quotation.update({
        where: { id },
        data: {
          ...(dto.clientId !== undefined && { clientId: dto.clientId }),
          ...(dto.insuranceTypeId !== undefined && {
            insuranceTypeId: dto.insuranceTypeId,
          }),
          ...(dto.insured !== undefined && { insured: dto.insured }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.quotationDate !== undefined && {
            quotationDate: new Date(dto.quotationDate),
          }),
          ...(dto.periodStart !== undefined && {
            periodStart: new Date(dto.periodStart),
          }),
          ...(dto.periodEnd !== undefined && {
            periodEnd: new Date(dto.periodEnd),
          }),
          ...(dto.interest !== undefined && { interest: dto.interest }),
          ...(dto.rate !== undefined && { rate: dto.rate }),
          ...(dto.premium !== undefined && { premium: dto.premium }),
          ...(dto.deductible !== undefined && { deductible: dto.deductible }),
          ...(dto.brokerage !== undefined && { brokerage: dto.brokerage }),
          ...(dto.templateVersion !== undefined && {
            templateVersion: dto.templateVersion,
          }),
          ...(existing.status === 'REVISION' &&
            Object.keys(dto).length > 0 && {
              insurerRevisionUpdatedAt: new Date(),
          }),
        },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} updated quotation ${existing.quotationNumber}`,
        },
      });

      return quotation;
    });
  }

  async delete(id: string, actor: Actor) {
    const existing = await this.assertEditable(id, actor.id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Can only delete quotation in DRAFT status',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.quotation.updateMany({
        where: { id, deletedAt: null, status: 'DRAFT' },
        data: { deletedAt: new Date() },
      });
      if (deleted.count !== 1) {
        throw new BadRequestException(
          'Quotation changed concurrently; retry the request',
        );
      }

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} deleted quotation ${existing.quotationNumber}`,
        },
      });

      return { id };
    });
  }

  async assertEditable(quotationId: string, actorId?: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
      select: {
        id: true,
        quotationNumber: true,
        status: true,
        technicalUnitId: true,
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    if (quotation.status !== 'DRAFT' && quotation.status !== 'REVISION') {
      throw new BadRequestException(
        'Can only edit quotation in DRAFT or REVISION status',
      );
    }

    if (actorId) {
      await this.assertTechnicalUnitOwnership(
        quotation.technicalUnitId,
        actorId,
      );
    }

    return quotation;
  }

  async markInsurerRevisionUpdated(quotationId: string) {
    await this.prisma.quotation.updateMany({
      where: { id: quotationId, deletedAt: null, status: 'REVISION' },
      data: { insurerRevisionUpdatedAt: new Date() },
    });
  }

  private async transitionStatus(
    id: string,
    nextStatus: string,
    actionLabel: string,
    actor: Actor,
    note?: string,
    options?: TransitionOptions,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.quotation.findFirst({
        where: { id, deletedAt: null },
        select: {
          id: true,
          quotationNumber: true,
          status: true,
          insurerRevisionRequestedAt: true,
          insurerRevisionUpdatedAt: true,
        },
      });
      if (!existing) throw new NotFoundException('Quotation not found');
      if (!validateTransition(existing.status, nextStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${existing.status} to ${nextStatus}`,
        );
      }
      if (
        options?.requiresInsurerRevisionEdit &&
        (!existing.insurerRevisionUpdatedAt ||
          !existing.insurerRevisionRequestedAt ||
          existing.insurerRevisionUpdatedAt <=
            existing.insurerRevisionRequestedAt)
      ) {
        throw new BadRequestException(
          'Edit the quotation after the insurer revision before resubmitting',
        );
      }

      let submissionSnapshot: Prisma.InputJsonValue | undefined;
      if (options?.insuranceCompanyId) {
        const insuranceCompany = await tx.insuranceCompany.findFirst({
          where: { id: options.insuranceCompanyId, deletedAt: null },
          select: { id: true },
        });
        if (!insuranceCompany) {
          throw new BadRequestException('Insurance company not found');
        }
        submissionSnapshot = await this.getSubmissionSnapshot(tx, id);
      }

      let reviewedSubmissionId: string | undefined;
      if (options?.insurerReviewAction) {
        const submission = await tx.quotationSubmission.findFirst({
          where: { quotationId: id, reviews: { none: {} } },
          orderBy: { sentAt: 'desc' },
          select: { id: true },
        });
        if (!submission) {
          throw new BadRequestException(
            'No pending insurance submission found',
          );
        }
        reviewedSubmissionId = submission.id;
      }

      const updateData: Prisma.QuotationUpdateManyMutationInput = {
        status: nextStatus as any,
      };
      if (options?.insurerReviewAction === 'REVISION') {
        updateData.insurerRevisionRequestedAt = new Date();
        updateData.insurerRevisionUpdatedAt = null;
      }

      const updated = await tx.quotation.updateMany({
        where: { id, deletedAt: null, status: existing.status },
        data: updateData,
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'Quotation changed concurrently; retry the request',
        );
      }

      if (nextStatus === 'APPROVED') {
        await tx.quotation.update({
          where: { id },
          data: {
            approvedBy: { connect: { id: actor.id } },
            approvedAt: new Date(),
          },
        });
      }

      if (options?.approvalAction) {
        await tx.quotationApproval.create({
          data: {
            quotationId: id,
            approverId: actor.id,
            action: options.approvalAction,
            note,
          },
        });
      }

      let submissionId: string | undefined;
      if (options?.insuranceCompanyId && submissionSnapshot) {
        const submission = await tx.quotationSubmission.create({
          data: {
            quotationId: id,
            insuranceCompanyId: options.insuranceCompanyId,
            sentById: actor.id,
            note,
            snapshot: submissionSnapshot,
          },
        });
        submissionId = submission.id;
      }

      if (options?.insurerReviewAction && reviewedSubmissionId) {
        await tx.insuranceReview.create({
          data: {
            quotationSubmissionId: reviewedSubmissionId,
            action: options.insurerReviewAction,
            note,
            recordedById: actor.id,
          },
        });
      }

      await tx.quotationHistory.create({
        data: {
          quotationId: id,
          fromStatus: existing.status,
          toStatus: nextStatus as any,
          action: actionLabel,
          actorId: actor.id,
          note,
        },
      });

      await tx.log.create({
        data: {
          action:
            options?.insurerReviewAction === 'APPROVED'
              ? 'APPROVE'
              : options?.insurerReviewAction === 'REVISION'
                ? 'REVISION'
                : 'UPDATE',
          referenceId: id,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} ${actionLabel} quotation ${existing.quotationNumber} (${existing.status} -> ${nextStatus})`,
        },
      });

      return { id, status: nextStatus, ...(submissionId && { submissionId }) };
    });
  }

  async submit(id: string, actor: Actor, dto?: ActionNoteDto) {
    await this.assertEditable(id, actor.id);
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      select: { status: true },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');

    const isInsurerRevision = quotation.status === 'REVISION';
    return this.transitionStatus(
      id,
      'WAITING_APPROVAL',
      isInsurerRevision ? 'RESUBMIT_FOR_APPROVAL' : 'SUBMIT',
      actor,
      dto?.note,
      {
        requiresInsurerRevisionEdit:
          isInsurerRevision &&
          REQUIRES_SUPERVISOR_APPROVAL_AFTER_INSURER_REVISION,
      },
    );
  }

  async approve(id: string, actor: Actor, dto?: ActionNoteDto) {
    await this.assertSupervisorTeknik(actor.id);
    return this.transitionStatus(id, 'APPROVED', 'APPROVE', actor, dto?.note, {
      approvalAction: 'APPROVED',
    });
  }

  async reject(id: string, actor: Actor, dto?: ActionNoteDto) {
    await this.assertSupervisorTeknik(actor.id);
    return this.transitionStatus(id, 'DRAFT', 'REJECT', actor, dto?.note, {
      approvalAction: 'REJECTED',
    });
  }

  async requestRevision(id: string, actor: Actor, dto?: ActionNoteDto) {
    await this.assertSupervisorTeknik(actor.id);
    return this.transitionStatus(
      id,
      'DRAFT',
      'REVISION_REQUEST',
      actor,
      dto?.note,
      { approvalAction: 'REVISION' },
    );
  }

  async sendToInsurance(id: string, actor: Actor, dto: SendToInsuranceDto) {
    await this.assertTechnicalOwnership(id, actor.id);
    return this.transitionStatus(
      id,
      'SENT_TO_INSURANCE',
      'SEND_TO_INSURANCE',
      actor,
      dto.note,
      { insuranceCompanyId: dto.insuranceCompanyId },
    );
  }

  async insuranceApprove(id: string, actor: Actor, dto?: ActionNoteDto) {
    return this.transitionStatus(
      id,
      'INSURANCE_APPROVED',
      'INSURANCE_APPROVE',
      actor,
      dto?.note,
      { insurerReviewAction: 'APPROVED' },
    );
  }

  async insuranceRevision(id: string, actor: Actor, dto?: ActionNoteDto) {
    return this.transitionStatus(
      id,
      'REVISION',
      'INSURANCE_REVISION',
      actor,
      dto?.note,
      { insurerReviewAction: 'REVISION' },
    );
  }

  async getApprovals(id: string) {
    await this.getExistingQuotation(id);
    return this.prisma.quotationApproval.findMany({
      where: { quotationId: id },
      include: { approver: { select: { id: true, fullname: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHistory(id: string) {
    await this.getExistingQuotation(id);
    return this.prisma.quotationHistory.findMany({
      where: { quotationId: id },
      include: { actor: { select: { id: true, fullname: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async exportPdf(id: string, actorId: string) {
    await this.assertTechnicalOwnership(id, actorId);
    const existing = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, quotationNumber: true, status: true },
    });
    if (!existing) throw new NotFoundException('Quotation not found');
    if (existing.status !== 'APPROVED') {
      throw new BadRequestException(
        'Only an approved quotation can be exported',
      );
    }

    return {
      message: 'PDF generation not yet implemented',
      quotationId: id,
      quotationNumber: existing.quotationNumber,
    };
  }

  private async getTechnicalUnitId(actorId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: actorId, deletedAt: null },
      select: {
        organizationUnit: {
          select: {
            id: true,
            name: true,
            type: true,
            deletedAt: true,
            parent: {
              select: { name: true, type: true, deletedAt: true },
            },
          },
        },
      },
    });
    const unit = user?.organizationUnit;
    if (
      !unit ||
      unit.deletedAt ||
      unit.type !== 'DEPARTMENT' ||
      !TECHNICAL_DEPARTMENTS.has(unit.name) ||
      !unit.parent ||
      unit.parent.deletedAt ||
      unit.parent.type !== 'DIVISION' ||
      unit.parent.name !== 'Teknik'
    ) {
      throw new ForbiddenException(
        'Only users assigned to Teknik H&M, P&I, or Cargo can create quotations',
      );
    }
    return unit.id;
  }

  private async assertSupervisorTeknik(actorId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: actorId, deletedAt: null },
      select: {
        role: true,
        organizationUnit: {
          select: {
            name: true,
            type: true,
            deletedAt: true,
            parent: {
              select: { name: true, type: true, deletedAt: true },
            },
          },
        },
      },
    });
    if (user?.role === 'SUPERADMIN') return;

    const unit = user?.organizationUnit;
    if (
      !unit ||
      unit.deletedAt ||
      unit.name !== 'Supervisor Teknik' ||
      unit.type !== 'DEPARTMENT' ||
      !unit.parent ||
      unit.parent.deletedAt ||
      unit.parent.name !== 'Teknik' ||
      unit.parent.type !== 'DIVISION'
    ) {
      throw new ForbiddenException(
        'Only Supervisor Teknik can approve, reject, or request a revision',
      );
    }
  }

  private async assertTechnicalOwnership(quotationId: string, actorId: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
      select: { technicalUnitId: true },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    await this.assertTechnicalUnitOwnership(quotation.technicalUnitId, actorId);
  }

  private async assertTechnicalUnitOwnership(
    technicalUnitId: string | null,
    actorId: string,
  ) {
    // Legacy quotations without an owner retain their existing permission behavior.
    if (!technicalUnitId) return;

    const actor = await this.prisma.user.findFirst({
      where: { id: actorId, deletedAt: null },
      select: { role: true, organizationUnitId: true },
    });
    if (!actor) throw new ForbiddenException('User is no longer active');
    if (
      actor.role !== 'SUPERADMIN' &&
      actor.organizationUnitId !== technicalUnitId
    ) {
      throw new ForbiddenException('Quotation belongs to another technical unit');
    }
  }

  private async assertActiveReferences(dto: UpdateQuotationDto) {
    const checks = await Promise.all([
      dto.clientId === undefined
        ? null
        : this.prisma.client.findFirst({
            where: { id: dto.clientId, deletedAt: null },
            select: { id: true },
          }),
      dto.insuranceTypeId === undefined
        ? null
        : this.prisma.insuranceType.findFirst({
            where: { id: dto.insuranceTypeId, deletedAt: null },
            select: { id: true },
          }),
    ]);
    if (dto.clientId !== undefined && !checks[0]) {
      throw new BadRequestException('Client not found');
    }
    if (dto.insuranceTypeId !== undefined && !checks[1]) {
      throw new BadRequestException('Insurance type not found');
    }
  }

  private async getExistingQuotation(id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  private async getSubmissionSnapshot(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const quotation = await tx.quotation.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: true,
        insuranceType: true,
        objects: { where: { deletedAt: null } },
        coverages: { where: { deletedAt: null } },
        terms: { where: { deletedAt: null } },
        warranties: { where: { deletedAt: null } },
        attachments: { where: { deletedAt: null } },
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return JSON.parse(JSON.stringify(quotation)) as Prisma.InputJsonValue;
  }
}
