import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { validateTransition } from '../quotations/quotations.constants';
import {
  IssuePolicyDto,
  ListPoliciesQuery,
  UpdatePolicyDto,
} from './policies.validation';
import {
  Actor,
  assertTechnicalUnitOwnership,
  summarizePlacement,
} from './policy.shared';

const quotationSummary = {
  select: {
    id: true,
    quotationNumber: true,
    status: true,
    technicalUnitId: true,
    client: { select: { id: true, name: true } },
    insuranceType: { select: { id: true, name: true } },
  },
} as const;

const participantInclude = {
  insuranceCompany: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(query: ListPoliciesQuery) {
    const where = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.insuranceTypeId && { insuranceTypeId: query.insuranceTypeId }),
      ...(query.quotationId && { quotationId: query.quotationId }),
      ...(query.q && {
        policyNumber: { contains: query.q, mode: 'insensitive' as const },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.policy.findMany({
        where,
        include: { quotation: quotationSummary },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.policy.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async get(id: string) {
    const policy = await this.prisma.policy.findFirst({
      where: { id, deletedAt: null },
      include: {
        quotation: quotationSummary,
        histories: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!policy) throw new NotFoundException('Policy not found');

    const participants = await this.prisma.policyParticipant.findMany({
      where: { quotationId: policy.quotationId, deletedAt: null },
      include: participantInclude,
      orderBy: [{ orderNo: 'asc' }, { createdAt: 'asc' }],
    });
    participants.sort(
      (a, b) => Number(b.role === 'LEADER') - Number(a.role === 'LEADER'),
    );

    return { ...policy, participants, ...summarizePlacement(participants) };
  }

  async issue(
    quotationId: string,
    dto: IssuePolicyDto,
    file: Express.Multer.File | undefined,
    actor: Actor,
  ) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
      select: {
        id: true,
        quotationNumber: true,
        status: true,
        technicalUnitId: true,
        insuranceTypeId: true,
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    if (
      quotation.status !== 'INSURANCE_APPROVED' ||
      !validateTransition(quotation.status, 'POLICY_ISSUED')
    ) {
      throw new BadRequestException(
        'Policy can only be issued for an insurance-approved quotation',
      );
    }
    await assertTechnicalUnitOwnership(
      this.prisma,
      quotation.technicalUnitId,
      actor.id,
    );

    // Policy.quotationId is unique, so a soft-deleted policy blocks it too.
    const existing = await this.prisma.policy.findFirst({
      where: { quotationId },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Quotation already has a policy');
    }

    const documentUrl = file
      ? await this.upload(`policies/${quotationId}`, file)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const moved = await tx.quotation.updateMany({
        where: { id: quotationId, deletedAt: null, status: quotation.status },
        data: { status: 'POLICY_ISSUED' },
      });
      if (moved.count !== 1) {
        throw new BadRequestException(
          'Quotation changed concurrently; retry the request',
        );
      }

      const policy = await tx.policy.create({
        data: {
          quotationId,
          policyNumber: dto.policyNumber,
          policyDate: dto.policyDate,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          insuranceTypeId: quotation.insuranceTypeId,
          issuedById: actor.id,
          status: 'POLICY_ISSUED',
          policyDocumentUrl: documentUrl,
          policyDocumentName: file?.originalname,
        },
      });

      await tx.policyParticipant.updateMany({
        where: { quotationId, deletedAt: null },
        data: { policyId: policy.id },
      });

      await tx.quotationHistory.create({
        data: {
          quotationId,
          fromStatus: quotation.status,
          toStatus: 'POLICY_ISSUED',
          action: 'ISSUE_POLICY',
          actorId: actor.id,
        },
      });
      await tx.policyHistory.create({
        data: {
          policyId: policy.id,
          toStatus: 'POLICY_ISSUED',
          action: 'ISSUE',
          actorId: actor.id,
        },
      });
      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: policy.id,
          referenceType: 'POLICY_PLACEMENT',
          userId: actor.id,
          description: `${actor.fullname} issued policy ${policy.policyNumber} for quotation ${quotation.quotationNumber}`,
        },
      });

      return policy;
    });
  }

  async update(id: string, dto: UpdatePolicyDto, actor: Actor) {
    const policy = await this.findPolicy(id);
    if (policy.status !== 'POLICY_ISSUED') {
      throw new BadRequestException(
        'Can only edit a policy in POLICY_ISSUED status',
      );
    }
    await assertTechnicalUnitOwnership(
      this.prisma,
      policy.quotation.technicalUnitId,
      actor.id,
    );

    const periodStart =
      dto.periodStart !== undefined ? dto.periodStart : policy.periodStart;
    const periodEnd =
      dto.periodEnd !== undefined ? dto.periodEnd : policy.periodEnd;
    if (periodStart && periodEnd && periodStart > periodEnd) {
      throw new BadRequestException(
        'periodEnd must not be earlier than periodStart',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.policy.updateMany({
        where: { id, deletedAt: null, status: 'POLICY_ISSUED' },
        data: {
          ...(dto.policyNumber !== undefined && {
            policyNumber: dto.policyNumber,
          }),
          ...(dto.policyDate !== undefined && { policyDate: dto.policyDate }),
          ...(dto.periodStart !== undefined && {
            periodStart: dto.periodStart,
          }),
          ...(dto.periodEnd !== undefined && { periodEnd: dto.periodEnd }),
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'Policy changed concurrently; retry the request',
        );
      }

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'POLICY_PLACEMENT',
          userId: actor.id,
          description: `${actor.fullname} updated policy ${dto.policyNumber ?? policy.policyNumber}`,
        },
      });

      return tx.policy.findFirst({ where: { id } });
    });
  }

  async uploadDocument(id: string, file: Express.Multer.File, actor: Actor) {
    const policy = await this.findPolicy(id);
    await assertTechnicalUnitOwnership(
      this.prisma,
      policy.quotation.technicalUnitId,
      actor.id,
    );

    const url = await this.upload(`policies/${policy.quotationId}`, file);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.policy.update({
        where: { id },
        data: { policyDocumentUrl: url, policyDocumentName: file.originalname },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'POLICY_PLACEMENT',
          userId: actor.id,
          description: `${actor.fullname} uploaded document ${file.originalname} for policy ${policy.policyNumber}`,
        },
      });

      return updated;
    });
  }

  async completePlacement(id: string, actor: Actor) {
    const policy = await this.findPolicy(id);
    if (policy.status !== 'POLICY_ISSUED') {
      throw new BadRequestException(
        'Placement can only be completed for a policy in POLICY_ISSUED status',
      );
    }
    await assertTechnicalUnitOwnership(
      this.prisma,
      policy.quotation.technicalUnitId,
      actor.id,
    );

    return this.prisma.$transaction(async (tx) => {
      const participants = await tx.policyParticipant.findMany({
        where: { quotationId: policy.quotationId, deletedAt: null },
        select: { role: true, share: true },
      });
      if (!summarizePlacement(participants).isComplete) {
        throw new BadRequestException(
          'Placement must have one leader and a total share of 100.00',
        );
      }

      const now = new Date();
      const updated = await tx.policy.updateMany({
        where: { id, deletedAt: null, status: 'POLICY_ISSUED' },
        data: { status: 'PLACEMENT_COMPLETED', placementCompletedAt: now },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'Policy changed concurrently; retry the request',
        );
      }

      await tx.policyParticipant.updateMany({
        where: { quotationId: policy.quotationId, deletedAt: null },
        data: { policyId: id },
      });

      await tx.policyHistory.create({
        data: {
          policyId: id,
          fromStatus: 'POLICY_ISSUED',
          toStatus: 'PLACEMENT_COMPLETED',
          action: 'COMPLETE_PLACEMENT',
          actorId: actor.id,
        },
      });
      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'POLICY_PLACEMENT',
          userId: actor.id,
          description: `${actor.fullname} completed placement of policy ${policy.policyNumber}`,
        },
      });

      return tx.policy.findFirst({ where: { id } });
    });
  }

  private async findPolicy(id: string) {
    const policy = await this.prisma.policy.findFirst({
      where: { id, deletedAt: null },
      include: { quotation: { select: { technicalUnitId: true } } },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  private upload(prefix: string, file: Express.Multer.File) {
    const key = `${prefix}/${randomUUID()}${extname(file.originalname)}`;
    return this.storage.upload(key, file.buffer, file.mimetype);
  }
}
