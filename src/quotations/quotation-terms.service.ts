import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateQuotationTermDto,
  UpdateQuotationTermDto,
} from './quotation-terms.validation';

@Injectable()
export class QuotationTermsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(quotationId: string) {
    return this.prisma.quotationTerm.findMany({
      where: { quotationId, deletedAt: null },
      include: { termsCondition: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(quotationId: string, id: string) {
    const term = await this.prisma.quotationTerm.findFirst({
      where: { id, quotationId, deletedAt: null },
      include: { termsCondition: true },
    });
    if (!term) throw new NotFoundException('Quotation term not found');
    return term;
  }

  async create(quotationId: string, dto: CreateQuotationTermDto) {
    return this.prisma.quotationTerm.create({
      data: {
        quotationId,
        termsConditionId: dto.termsConditionId,
        description: dto.description,
      },
    });
  }

  async update(quotationId: string, id: string, dto: UpdateQuotationTermDto) {
    const existing = await this.prisma.quotationTerm.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation term not found');

    return this.prisma.quotationTerm.update({
      where: { id },
      data: {
        ...(dto.termsConditionId !== undefined && {
          termsConditionId: dto.termsConditionId,
        }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async delete(quotationId: string, id: string) {
    const existing = await this.prisma.quotationTerm.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation term not found');

    await this.prisma.quotationTerm.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { id };
  }
}
