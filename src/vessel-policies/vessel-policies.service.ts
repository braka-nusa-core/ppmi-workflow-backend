import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  normalizeClubCode,
  normalizePolicyNumber,
  vesselPolicyCoverageKey,
} from '../vessels/vessel.util';
import {
  CreateVesselPolicyDto,
  ListVesselPoliciesQuery,
  UpdateVesselPolicyDto,
} from './vessel-policies.validation';

type Actor = { id: string; fullname: string };

const policySelect = {
  id: true,
  vesselId: true,
  clientId: true,
  policyNumber: true,
  policyNumberRaw: true,
  insuredRaw: true,
  periodRaw: true,
  periodStart: true,
  periodEnd: true,
  clubCode: true,
  clubRaw: true,
  status: true,
  statusRaw: true,
  createdAt: true,
  updatedAt: true,
  vessel: { select: { id: true, name: true } },
  client: { select: { id: true, name: true, clientCode: true } },
} as const;

@Injectable()
export class VesselPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListVesselPoliciesQuery) {
    const now = new Date();
    const where = {
      deletedAt: null,
      ...(query.clientId && { clientId: query.clientId }),
      ...(query.vesselId && { vesselId: query.vesselId }),
      ...(query.status && { status: query.status }),
      ...(query.expiringWithinDays !== undefined && {
        periodEnd: {
          gte: now,
          lte: new Date(now.getTime() + query.expiringWithinDays * 86_400_000),
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.vesselPolicy.findMany({
        where,
        select: policySelect,
        orderBy: { periodEnd: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.vesselPolicy.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async get(id: string) {
    const policy = await this.prisma.vesselPolicy.findFirst({
      where: { id, deletedAt: null },
      select: policySelect,
    });
    if (!policy) throw new NotFoundException('Vessel policy not found');
    return policy;
  }

  async create(dto: CreateVesselPolicyDto, actor: Actor) {
    const vessel = await this.prisma.vessel.findFirst({
      where: { id: dto.vesselId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!vessel) throw new NotFoundException('Vessel not found');

    await this.assertClientActive(dto.clientId);

    const policyNumber = dto.policyNumber
      ? normalizePolicyNumber(dto.policyNumber)
      : null;
    const periodStart = dto.periodStart ?? null;
    const coverageKey = vesselPolicyCoverageKey(
      vessel.id,
      policyNumber,
      periodStart,
    );
    await this.assertCoverageAvailable(coverageKey);

    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.vesselPolicy.create({
        data: {
          vesselId: vessel.id,
          clientId: dto.clientId,
          coverageKey,
          policyNumber,
          policyNumberRaw: dto.policyNumberRaw,
          insuredRaw: dto.insuredRaw,
          periodRaw: dto.periodRaw,
          periodStart,
          periodEnd: dto.periodEnd,
          clubCode: dto.clubCode ? normalizeClubCode(dto.clubCode) : undefined,
          clubRaw: dto.clubRaw,
          status: dto.status,
          statusRaw: dto.statusRaw,
        },
        select: policySelect,
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: policy.id,
          referenceType: 'VESSEL_POLICY',
          userId: actor.id,
          description: `${actor.fullname} created policy ${policy.policyNumber ?? '-'} for vessel ${vessel.name}`,
        },
      });

      return policy;
    });
  }

  async update(id: string, dto: UpdateVesselPolicyDto, actor: Actor) {
    const existing = await this.prisma.vesselPolicy.findFirst({
      where: { id, deletedAt: null },
      select: {
        vesselId: true,
        policyNumber: true,
        periodStart: true,
        coverageKey: true,
      },
    });
    if (!existing) throw new NotFoundException('Vessel policy not found');

    if (dto.clientId !== undefined) {
      await this.assertClientActive(dto.clientId);
    }

    const policyNumber =
      dto.policyNumber === undefined
        ? existing.policyNumber
        : dto.policyNumber
          ? normalizePolicyNumber(dto.policyNumber)
          : null;
    const periodStart =
      dto.periodStart === undefined ? existing.periodStart : dto.periodStart;

    const coverageKey = vesselPolicyCoverageKey(
      existing.vesselId,
      policyNumber,
      periodStart,
    );
    if (coverageKey !== existing.coverageKey) {
      await this.assertCoverageAvailable(coverageKey, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.vesselPolicy.update({
        where: { id },
        data: {
          coverageKey,
          policyNumber,
          periodStart,
          ...(dto.clientId !== undefined && { clientId: dto.clientId }),
          ...(dto.policyNumberRaw !== undefined && {
            policyNumberRaw: dto.policyNumberRaw,
          }),
          ...(dto.insuredRaw !== undefined && { insuredRaw: dto.insuredRaw }),
          ...(dto.periodRaw !== undefined && { periodRaw: dto.periodRaw }),
          ...(dto.periodEnd !== undefined && { periodEnd: dto.periodEnd }),
          ...(dto.clubCode !== undefined && {
            clubCode: dto.clubCode ? normalizeClubCode(dto.clubCode) : null,
          }),
          ...(dto.clubRaw !== undefined && { clubRaw: dto.clubRaw }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.statusRaw !== undefined && { statusRaw: dto.statusRaw }),
        },
        select: policySelect,
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'VESSEL_POLICY',
          userId: actor.id,
          description: `${actor.fullname} updated policy ${policy.policyNumber ?? '-'}`,
        },
      });

      return policy;
    });
  }

  async delete(id: string, actor: Actor) {
    const existing = await this.prisma.vesselPolicy.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, policyNumber: true },
    });
    if (!existing) throw new NotFoundException('Vessel policy not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.vesselPolicy.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'VESSEL_POLICY',
          userId: actor.id,
          description: `${actor.fullname} deleted policy ${existing.policyNumber ?? '-'}`,
        },
      });

      return { id };
    });
  }

  private async assertClientActive(clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new BadRequestException('Client not found');
  }

  private async assertCoverageAvailable(coverageKey: string, exceptId?: string) {
    const taken = await this.prisma.vesselPolicy.findFirst({
      where: { coverageKey, ...(exceptId && { NOT: { id: exceptId } }) },
      select: { id: true },
    });
    if (taken) {
      throw new BadRequestException(
        'A policy with the same vessel, policy number, and period start already exists',
      );
    }
  }
}
