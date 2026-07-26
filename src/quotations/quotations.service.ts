import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { ClientsService } from '../clients/clients.service';
import {
  CreateQuotationDto,
  UpdateQuotationDto,
  ActionNoteDto,
} from './quotations.validation';
import { validateTransition } from './quotations.constants';

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
        approvals: { orderBy: { createdAt: 'desc' } },
        histories: { orderBy: { createdAt: 'desc' } },
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

  async create(dto: CreateQuotationDto, actor: { id: string; fullname: string }) {
    const quotationNumber = await this.generateQuotationNumber();

    return this.prisma.$transaction(async (tx) => {
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
      }

      const quotation = await tx.quotation.create({
        data: {
          quotationNumber,
          clientId: resolvedClientId!,
          insuranceTypeId: dto.insuranceTypeId,
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

  async update(
    id: string,
    dto: UpdateQuotationDto,
    actor: { id: string; fullname: string },
  ) {
    const existing = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation not found');
    if (existing.status !== 'DRAFT' && existing.status !== 'REVISION') {
      throw new BadRequestException(
        'Can only edit quotation in DRAFT or REVISION status',
      );
    }

    return this.prisma.$transaction(async (tx) => {
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
        },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} updated quotation ${quotation.quotationNumber}`,
        },
      });

      return quotation;
    });
  }

  async delete(id: string, actor: { id: string; fullname: string }) {
    const existing = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, quotationNumber: true, status: true },
    });
    if (!existing) throw new NotFoundException('Quotation not found');
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Can only delete quotation in DRAFT status');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

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

  private async transitionStatus(
    id: string,
    nextStatus: string,
    actionLabel: string,
    actor: { id: string; fullname: string },
    note?: string,
    approvalAction?: string,
  ) {
    const existing = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, quotationNumber: true, status: true },
    });
    if (!existing) throw new NotFoundException('Quotation not found');

    if (!validateTransition(existing.status, nextStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${existing.status} to ${nextStatus}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === 'APPROVED') {
        updateData.approvedById = actor.id;
        updateData.approvedAt = new Date();
      }

      await tx.quotation.update({
        where: { id },
        data: updateData,
      });

      await tx.quotationHistory.create({
        data: {
          quotationId: id,
          fromStatus: existing.status as any,
          toStatus: nextStatus as any,
          action: actionLabel,
          actorId: actor.id,
          note,
        },
      });

      if (approvalAction) {
        await tx.quotationApproval.create({
          data: {
            quotationId: id,
            approverId: actor.id,
            action: approvalAction as any,
            note,
          },
        });
      }

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} ${actionLabel} quotation ${existing.quotationNumber} (${existing.status} → ${nextStatus})`,
        },
      });

      return { id, status: nextStatus };
    });
  }

  async submit(id: string, actor: { id: string; fullname: string }, dto?: ActionNoteDto) {
    return this.transitionStatus(id, 'WAITING_APPROVAL', 'SUBMIT', actor, dto?.note);
  }

  async approve(id: string, actor: { id: string; fullname: string }, dto?: ActionNoteDto) {
    return this.transitionStatus(
      id,
      'APPROVED',
      'APPROVE',
      actor,
      dto?.note,
      'APPROVED',
    );
  }

  async reject(id: string, actor: { id: string; fullname: string }, dto?: ActionNoteDto) {
    return this.transitionStatus(
      id,
      'DRAFT',
      'REJECT',
      actor,
      dto?.note,
      'REJECTED',
    );
  }

  async requestRevision(
    id: string,
    actor: { id: string; fullname: string },
    dto?: ActionNoteDto,
  ) {
    return this.transitionStatus(
      id,
      'DRAFT',
      'REVISION_REQUEST',
      actor,
      dto?.note,
      'REVISION',
    );
  }

  async sendToInsurance(
    id: string,
    actor: { id: string; fullname: string },
    dto?: ActionNoteDto,
  ) {
    return this.transitionStatus(
      id,
      'SENT_TO_INSURANCE',
      'SEND_TO_INSURANCE',
      actor,
      dto?.note,
    );
  }

  async insuranceApprove(
    id: string,
    actor: { id: string; fullname: string },
    dto?: ActionNoteDto,
  ) {
    return this.transitionStatus(
      id,
      'POLICY_ISSUED',
      'INSURANCE_APPROVE',
      actor,
      dto?.note,
    );
  }

  async insuranceRevision(
    id: string,
    actor: { id: string; fullname: string },
    dto?: ActionNoteDto,
  ) {
    return this.transitionStatus(
      id,
      'REVISION',
      'INSURANCE_REVISION',
      actor,
      dto?.note,
    );
  }

  async getApprovals(id: string) {
    const existing = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Quotation not found');

    return this.prisma.quotationApproval.findMany({
      where: { quotationId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHistory(id: string) {
    const existing = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Quotation not found');

    return this.prisma.quotationHistory.findMany({
      where: { quotationId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async exportPdf(id: string) {
    const existing = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, quotationNumber: true },
    });
    if (!existing) throw new NotFoundException('Quotation not found');

    return {
      message: 'PDF generation not yet implemented',
      quotationId: id,
      quotationNumber: existing.quotationNumber,
    };
  }
}
