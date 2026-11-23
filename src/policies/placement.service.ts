import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/services/prisma.service';
import { ReplacePlacementDto } from './policies.validation';
import {
  Actor,
  assertTechnicalUnitOwnership,
  lockQuotation,
  summarizePlacement,
} from './policy.shared';

const PLACEMENT_STATUSES = ['INSURANCE_APPROVED', 'POLICY_ISSUED'];

const participantInclude = {
  insuranceCompany: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class PlacementService {
  constructor(private readonly prisma: PrismaService) {}

  async get(quotationId: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
      select: { id: true },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');

    const participants = await this.prisma.policyParticipant.findMany({
      where: { quotationId, deletedAt: null },
      include: participantInclude,
      orderBy: [{ orderNo: 'asc' }, { createdAt: 'asc' }],
    });
    // LEADER first, then by orderNo (the database already ordered those).
    participants.sort(
      (a, b) => Number(b.role === 'LEADER') - Number(a.role === 'LEADER'),
    );

    return { participants, ...summarizePlacement(participants) };
  }

  /** Replaces the whole set of participants in one transaction. */
  async replace(quotationId: string, dto: ReplacePlacementDto, actor: Actor) {
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
    if (!PLACEMENT_STATUSES.includes(quotation.status)) {
      throw new BadRequestException(
        'Placement requires an insurance-approved quotation',
      );
    }
    await assertTechnicalUnitOwnership(
      this.prisma,
      quotation.technicalUnitId,
      actor.id,
    );

    const companyIds = dto.participants.map((item) => item.insuranceCompanyId);
    const companies = await this.prisma.insuranceCompany.findMany({
      where: { id: { in: companyIds }, deletedAt: null },
      select: { id: true },
    });
    if (companies.length !== companyIds.length) {
      throw new BadRequestException('Insurance company not found');
    }

    await this.prisma.$transaction(async (tx) => {
      if (!(await lockQuotation(tx, quotationId, PLACEMENT_STATUSES))) {
        throw new BadRequestException(
          'Quotation changed concurrently; retry the request',
        );
      }

      const policy = await tx.policy.findFirst({
        where: { quotationId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (policy?.status === 'PLACEMENT_COMPLETED') {
        throw new BadRequestException('Placement is already completed');
      }

      await tx.policyParticipant.updateMany({
        where: { quotationId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await tx.policyParticipant.createMany({
        data: dto.participants.map((item, index) => ({
          quotationId,
          policyId: policy?.id ?? null,
          insuranceCompanyId: item.insuranceCompanyId,
          role: item.role,
          share: new Prisma.Decimal(item.share.toFixed(2)),
          orderNo: item.orderNo ?? index + 1,
        })),
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: quotationId,
          referenceType: 'POLICY_PLACEMENT',
          userId: actor.id,
          description: `${actor.fullname} set placement of quotation ${quotation.quotationNumber} (${dto.participants.length} participants)`,
        },
      });
    });

    return this.get(quotationId);
  }
}
