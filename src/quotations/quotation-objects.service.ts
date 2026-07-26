import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateQuotationObjectDto,
  UpdateQuotationObjectDto,
} from './quotation-objects.validation';

@Injectable()
export class QuotationObjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(quotationId: string) {
    return this.prisma.quotationObject.findMany({
      where: { quotationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(quotationId: string, id: string) {
    const obj = await this.prisma.quotationObject.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!obj) throw new NotFoundException('Quotation object not found');
    return obj;
  }

  async create(quotationId: string, dto: CreateQuotationObjectDto) {
    return this.prisma.quotationObject.create({
      data: {
        quotationId,
        objectType: dto.objectType,
        data: dto.data,
      },
    });
  }

  async update(quotationId: string, id: string, dto: UpdateQuotationObjectDto) {
    const existing = await this.prisma.quotationObject.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation object not found');

    return this.prisma.quotationObject.update({
      where: { id },
      data: {
        ...(dto.objectType !== undefined && { objectType: dto.objectType }),
        ...(dto.data !== undefined && { data: dto.data }),
      },
    });
  }

  async delete(quotationId: string, id: string) {
    const existing = await this.prisma.quotationObject.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation object not found');

    await this.prisma.quotationObject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { id };
  }
}
