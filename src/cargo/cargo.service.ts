import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { QuotationsService } from '../quotations/quotations.service';
import {
  CreateCargoQuotationDto,
  UpdateCargoQuotationDto,
} from './cargo.validation';

type Actor = { id: string; fullname: string };

@Injectable()
export class CargoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotationsService: QuotationsService,
  ) {}

  async getTemplate() {
    const template = await this.prisma.qsTemplate.findFirst({
      where: { templateDomain: 'CARGO', deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (!template)
      throw new NotFoundException('Cargo quotation template not found');
    return template;
  }

  async get(quotationId: string) {
    const detail = await this.prisma.cargoQuotation.findFirst({
      where: { quotationId, deletedAt: null, quotation: { deletedAt: null } },
      include: this.detailInclude(),
    });
    if (!detail)
      throw new NotFoundException('Cargo quotation detail not found');
    return detail;
  }

  async create(
    quotationId: string,
    dto: CreateCargoQuotationDto,
    actor: Actor,
  ) {
    await this.assertCargoQuotation(quotationId, actor.id);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cargoQuotation.findFirst({
        where: { quotationId, deletedAt: null },
        select: { id: true },
      });
      if (existing)
        throw new BadRequestException('Cargo quotation detail already exists');

      const detail = await tx.cargoQuotation.create({
        data: { quotationId, ...this.data(dto) },
      });
      await this.syncAssignments(
        tx,
        quotationId,
        dto.adjusterIds,
        dto.surveyorIds,
      );
      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: quotationId,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} created Cargo quotation detail`,
        },
      });
      return tx.cargoQuotation.findUniqueOrThrow({
        where: { id: detail.id },
        include: this.detailInclude(),
      });
    });
  }

  async update(
    quotationId: string,
    dto: UpdateCargoQuotationDto,
    actor: Actor,
  ) {
    await this.assertCargoQuotation(quotationId, actor.id);
    return this.prisma.$transaction(async (tx) => {
      const detail = await tx.cargoQuotation.findFirst({
        where: { quotationId, deletedAt: null },
      });
      if (!detail)
        throw new NotFoundException('Cargo quotation detail not found');
      await tx.cargoQuotation.update({
        where: { id: detail.id },
        data: this.data(dto),
      });
      await this.syncAssignments(
        tx,
        quotationId,
        dto.adjusterIds,
        dto.surveyorIds,
      );
      await this.quotationsService.markInsurerRevisionUpdated(quotationId);
      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: quotationId,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} updated Cargo quotation detail`,
        },
      });
      return tx.cargoQuotation.findUniqueOrThrow({
        where: { id: detail.id },
        include: this.detailInclude(),
      });
    });
  }

  private detailInclude() {
    return {
      quotation: {
        include: {
          client: true,
          insuranceType: true,
          adjusters: {
            include: { adjuster: true },
            orderBy: { sortOrder: 'asc' as const },
          },
          surveyors: {
            include: { surveyor: true },
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      },
    };
  }

  private data(dto: CreateCargoQuotationDto | UpdateCargoQuotationDto) {
    return {
      ...(dto.interestInsured !== undefined && {
        interestInsured: dto.interestInsured,
      }),
      ...(dto.voyageFrom !== undefined && { voyageFrom: dto.voyageFrom }),
      ...(dto.voyageTo !== undefined && { voyageTo: dto.voyageTo }),
      ...(dto.etd !== undefined && { etd: this.toDate(dto.etd) }),
      ...(dto.eta !== undefined && { eta: this.toDate(dto.eta) }),
      ...(dto.conveyance !== undefined && { conveyance: dto.conveyance }),
      ...(dto.instituteCargoClause !== undefined && {
        instituteCargoClause: dto.instituteCargoClause,
      }),
    };
  }

  private async assertCargoQuotation(quotationId: string, actorId: string) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const quotation = await this.prisma.quotation.findFirst({
      where: {
        id: quotationId,
        deletedAt: null,
        insuranceType: { code: 'CARGO', deletedAt: null },
      },
      select: { id: true },
    });
    if (!quotation)
      throw new BadRequestException('Quotation insurance type must be CARGO');
  }

  private async syncAssignments(
    tx: any,
    quotationId: string,
    adjusterIds: string[] | undefined,
    surveyorIds: string[] | undefined,
  ) {
    if (adjusterIds !== undefined) {
      await this.assertActiveReferences(tx.adjuster, adjusterIds, 'Adjuster');
      await tx.quotationAdjuster.deleteMany({ where: { quotationId } });
      if (adjusterIds.length)
        await tx.quotationAdjuster.createMany({
          data: adjusterIds.map((adjusterId, sortOrder) => ({
            quotationId,
            adjusterId,
            sortOrder,
          })),
        });
    }
    if (surveyorIds !== undefined) {
      await this.assertActiveReferences(tx.surveyor, surveyorIds, 'Surveyor');
      await tx.quotationSurveyor.deleteMany({ where: { quotationId } });
      if (surveyorIds.length)
        await tx.quotationSurveyor.createMany({
          data: surveyorIds.map((surveyorId, sortOrder) => ({
            quotationId,
            surveyorId,
            sortOrder,
          })),
        });
    }
  }

  private async assertActiveReferences(
    model: any,
    ids: string[],
    label: string,
  ) {
    const count = await model.count({
      where: { id: { in: ids }, deletedAt: null },
    });
    if (count !== ids.length)
      throw new BadRequestException(`${label} not found or inactive`);
  }

  private toDate(value?: string) {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('Invalid date');
    return date;
  }
}
