import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateQuotationObjectDto,
  UpdateQuotationObjectDto,
} from './quotation-objects.validation';
import { QuotationsService } from './quotations.service';

@Injectable()
export class QuotationObjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotationsService: QuotationsService,
  ) {}

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

  async create(
    quotationId: string,
    dto: CreateQuotationObjectDto,
    actorId: string,
  ) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const object = await this.prisma.quotationObject.create({
      data: {
        quotationId,
        objectType: dto.objectType,
        data: dto.data,
      },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);
    return object;
  }

  async update(
    quotationId: string,
    id: string,
    dto: UpdateQuotationObjectDto,
    actorId: string,
  ) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const existing = await this.prisma.quotationObject.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation object not found');

    const object = await this.prisma.quotationObject.update({
      where: { id },
      data: {
        ...(dto.objectType !== undefined && { objectType: dto.objectType }),
        ...(dto.data !== undefined && { data: dto.data }),
      },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);
    return object;
  }

  async delete(quotationId: string, id: string, actorId: string) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const existing = await this.prisma.quotationObject.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation object not found');

    await this.prisma.quotationObject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);

    return { id };
  }
}
