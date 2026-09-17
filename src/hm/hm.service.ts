import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { QuotationsService } from '../quotations/quotations.service';
import { CreateHmQuotationDto, UpdateHmQuotationDto } from './hm.validation';

type Actor = { id: string; fullname: string };

@Injectable()
export class HmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotationsService: QuotationsService,
  ) {}

  async getTemplate() {
    const template = await this.prisma.qsTemplate.findFirst({
      where: { templateDomain: 'HULL_MACHINERY', deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (!template)
      throw new NotFoundException('H&M quotation template not found');
    return template;
  }

  async get(quotationId: string) {
    const detail = await this.prisma.hmQuotation.findFirst({
      where: { quotationId, deletedAt: null, quotation: { deletedAt: null } },
      include: this.detailInclude(),
    });
    if (!detail) throw new NotFoundException('H&M quotation detail not found');
    return detail;
  }

  async create(quotationId: string, dto: CreateHmQuotationDto, actor: Actor) {
    await this.assertHmQuotation(quotationId, actor.id);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.hmQuotation.findFirst({
        where: { quotationId, deletedAt: null },
        select: { id: true },
      });
      if (existing)
        throw new BadRequestException('H&M quotation detail already exists');

      const detail = await tx.hmQuotation.create({
        data: {
          quotationId,
          vesselType: dto.vesselType,
          tradingWarranty: dto.tradingWarranty,
          premiumPaymentEnabled: dto.premiumPaymentEnabled,
          brokerageEnabled: dto.brokerageEnabled,
        },
      });
      await this.syncInstallments(tx, detail.id, dto.installments);
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
          description: `${actor.fullname} created H&M quotation detail`,
        },
      });

      return tx.hmQuotation.findUniqueOrThrow({
        where: { id: detail.id },
        include: this.detailInclude(),
      });
    });
  }

  async update(quotationId: string, dto: UpdateHmQuotationDto, actor: Actor) {
    await this.assertHmQuotation(quotationId, actor.id);

    return this.prisma.$transaction(async (tx) => {
      const detail = await tx.hmQuotation.findFirst({
        where: { quotationId, deletedAt: null },
      });
      if (!detail)
        throw new NotFoundException('H&M quotation detail not found');

      await tx.hmQuotation.update({
        where: { id: detail.id },
        data: {
          ...(dto.vesselType !== undefined && { vesselType: dto.vesselType }),
          ...(dto.tradingWarranty !== undefined && {
            tradingWarranty: dto.tradingWarranty,
          }),
          ...(dto.premiumPaymentEnabled !== undefined && {
            premiumPaymentEnabled: dto.premiumPaymentEnabled,
          }),
          ...(dto.brokerageEnabled !== undefined && {
            brokerageEnabled: dto.brokerageEnabled,
          }),
        },
      });
      await this.syncInstallments(tx, detail.id, dto.installments);
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
          description: `${actor.fullname} updated H&M quotation detail`,
        },
      });

      return tx.hmQuotation.findUniqueOrThrow({
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
      installments: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
      },
    };
  }

  private async assertHmQuotation(quotationId: string, actorId: string) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const quotation = await this.prisma.quotation.findFirst({
      where: {
        id: quotationId,
        deletedAt: null,
        insuranceType: { code: 'HM', deletedAt: null },
      },
      select: { id: true },
    });
    if (!quotation) {
      throw new BadRequestException('Quotation insurance type must be HM');
    }
  }

  private async syncInstallments(
    tx: any,
    hmQuotationId: string,
    installments: CreateHmQuotationDto['installments'] | undefined,
  ) {
    if (installments === undefined) return;
    const numbers = installments.map(
      (installment) => installment.installmentNo,
    );
    if (new Set(numbers).size !== numbers.length) {
      throw new BadRequestException('H&M installment numbers must be unique');
    }

    await tx.hmQuotationInstallment.updateMany({
      where: {
        hmQuotationId,
        deletedAt: null,
        ...(numbers.length > 0 ? { installmentNo: { notIn: numbers } } : {}),
      },
      data: { deletedAt: new Date() },
    });

    for (const [index, installment] of installments.entries()) {
      await tx.hmQuotationInstallment.upsert({
        where: {
          hmQuotationId_installmentNo: {
            hmQuotationId,
            installmentNo: installment.installmentNo,
          },
        },
        create: {
          hmQuotationId,
          installmentNo: installment.installmentNo,
          percentage: installment.percentage,
          dueAfterDays: installment.dueAfterDays,
          amount: installment.amount,
          currency: installment.currency,
          dueDate: this.toDate(installment.dueDate),
          sortOrder: installment.sortOrder ?? index,
        },
        update: {
          percentage: installment.percentage,
          dueAfterDays: installment.dueAfterDays,
          amount: installment.amount,
          currency: installment.currency,
          dueDate: this.toDate(installment.dueDate),
          sortOrder: installment.sortOrder ?? index,
          deletedAt: null,
        },
      });
    }
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
      if (adjusterIds.length) {
        await tx.quotationAdjuster.createMany({
          data: adjusterIds.map((adjusterId, sortOrder) => ({
            quotationId,
            adjusterId,
            sortOrder,
          })),
        });
      }
    }
    if (surveyorIds !== undefined) {
      await this.assertActiveReferences(tx.surveyor, surveyorIds, 'Surveyor');
      await tx.quotationSurveyor.deleteMany({ where: { quotationId } });
      if (surveyorIds.length) {
        await tx.quotationSurveyor.createMany({
          data: surveyorIds.map((surveyorId, sortOrder) => ({
            quotationId,
            surveyorId,
            sortOrder,
          })),
        });
      }
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
    if (count !== ids.length) {
      throw new BadRequestException(`${label} not found or inactive`);
    }
  }

  private toDate(value?: string) {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('Invalid date');
    return date;
  }
}
