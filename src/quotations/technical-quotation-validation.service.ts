import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

@Injectable()
export class TechnicalQuotationValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validateForSubmit(quotationId: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
      select: {
        insuranceType: { select: { code: true } },
        hmQuotation: {
          where: { deletedAt: null },
          select: {
            premiumPaymentEnabled: true,
            installments: {
              where: { deletedAt: null },
              select: { installmentNo: true },
            },
          },
        },
        cargoQuotation: {
          where: { deletedAt: null },
          select: { instituteCargoClause: true },
        },
      },
    });
    if (!quotation) return;

    if (quotation.insuranceType.code === 'HM') {
      if (!quotation.hmQuotation) {
        throw new BadRequestException('H&M quotation detail is required');
      }
      if (
        quotation.hmQuotation.premiumPaymentEnabled &&
        quotation.hmQuotation.installments.length !== 4
      ) {
        throw new BadRequestException(
          'H&M quotation requires four instalments when premium payment is enabled',
        );
      }
    }

    if (quotation.insuranceType.code === 'CARGO') {
      if (!quotation.cargoQuotation) {
        throw new BadRequestException('Cargo quotation detail is required');
      }
      if (!quotation.cargoQuotation.instituteCargoClause) {
        throw new BadRequestException(
          'Cargo quotation requires one Institute Cargo Clause selection',
        );
      }
    }
  }
}
