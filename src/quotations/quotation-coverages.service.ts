import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateQuotationCoverageDto,
  UpdateQuotationCoverageDto,
} from './quotation-coverages.validation';

@Injectable()
export class QuotationCoveragesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(quotationId: string) {
    return this.prisma.quotationCoverage.findMany({
      where: { quotationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(quotationId: string, id: string) {
    const cov = await this.prisma.quotationCoverage.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!cov) throw new NotFoundException('Quotation coverage not found');
    return cov;
  }

  async create(quotationId: string, dto: CreateQuotationCoverageDto) {
    return this.prisma.quotationCoverage.create({
      data: {
        quotationId,
        coverageType: dto.coverageType,
        description: dto.description,
        value: dto.value,
      },
    });
  }

  async update(
    quotationId: string,
    id: string,
    dto: UpdateQuotationCoverageDto,
  ) {
    const existing = await this.prisma.quotationCoverage.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation coverage not found');

    return this.prisma.quotationCoverage.update({
      where: { id },
      data: {
        ...(dto.coverageType !== undefined && {
          coverageType: dto.coverageType,
        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.value !== undefined && { value: dto.value }),
      },
    });
  }

  async delete(quotationId: string, id: string) {
    const existing = await this.prisma.quotationCoverage.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation coverage not found');

    await this.prisma.quotationCoverage.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { id };
  }
}
