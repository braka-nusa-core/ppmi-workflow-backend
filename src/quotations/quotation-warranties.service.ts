import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateQuotationWarrantyDto,
  UpdateQuotationWarrantyDto,
} from './quotation-warranties.validation';
import { QuotationsService } from './quotations.service';

@Injectable()
export class QuotationWarrantiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotationsService: QuotationsService,
  ) {}

  async list(quotationId: string) {
    return this.prisma.quotationWarranty.findMany({
      where: { quotationId, deletedAt: null },
      include: { warranty: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(quotationId: string, id: string) {
    const warranty = await this.prisma.quotationWarranty.findFirst({
      where: { id, quotationId, deletedAt: null },
      include: { warranty: true },
    });
    if (!warranty) throw new NotFoundException('Quotation warranty not found');
    return warranty;
  }

  async create(
    quotationId: string,
    dto: CreateQuotationWarrantyDto,
    actorId: string,
  ) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const warranty = await this.prisma.quotationWarranty.create({
      data: {
        quotationId,
        warrantyId: dto.warrantyId,
        description: dto.description,
      },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);
    return warranty;
  }

  async update(
    quotationId: string,
    id: string,
    dto: UpdateQuotationWarrantyDto,
    actorId: string,
  ) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const existing = await this.prisma.quotationWarranty.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation warranty not found');

    const warranty = await this.prisma.quotationWarranty.update({
      where: { id },
      data: {
        ...(dto.warrantyId !== undefined && { warrantyId: dto.warrantyId }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);
    return warranty;
  }

  async delete(quotationId: string, id: string, actorId: string) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const existing = await this.prisma.quotationWarranty.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation warranty not found');

    await this.prisma.quotationWarranty.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);

    return { id };
  }
}
