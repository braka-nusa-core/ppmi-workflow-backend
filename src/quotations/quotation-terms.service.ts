import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateQuotationTermDto,
  UpdateQuotationTermDto,
} from './quotation-terms.validation';
import { QuotationsService } from './quotations.service';

@Injectable()
export class QuotationTermsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotationsService: QuotationsService,
  ) {}

  async list(quotationId: string) {
    return this.prisma.quotationTerm.findMany({
      where: { quotationId, deletedAt: null },
      include: { termsCondition: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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

  async create(
    quotationId: string,
    dto: CreateQuotationTermDto,
    actorId: string,
  ) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const term = await this.prisma.quotationTerm.create({
      data: {
        quotationId,
        termsConditionId: dto.termsConditionId,
        description: dto.description,
        section: dto.section,
        sortOrder: dto.sortOrder,
        isSelected: dto.isSelected,
        isEditable: dto.isEditable,
        isRemovable: dto.isRemovable,
        selectionGroup: dto.selectionGroup,
        conditionRule: dto.conditionRule as Prisma.InputJsonValue | undefined,
      },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);
    return term;
  }

  async update(
    quotationId: string,
    id: string,
    dto: UpdateQuotationTermDto,
    actorId: string,
  ) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const existing = await this.prisma.quotationTerm.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation term not found');

    const term = await this.prisma.quotationTerm.update({
      where: { id },
      data: {
        ...(dto.termsConditionId !== undefined && {
          termsConditionId: dto.termsConditionId,
        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.section !== undefined && { section: dto.section }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isSelected !== undefined && { isSelected: dto.isSelected }),
        ...(dto.isEditable !== undefined && { isEditable: dto.isEditable }),
        ...(dto.isRemovable !== undefined && { isRemovable: dto.isRemovable }),
        ...(dto.selectionGroup !== undefined && {
          selectionGroup: dto.selectionGroup,
        }),
        ...(dto.conditionRule !== undefined && {
          conditionRule: dto.conditionRule as Prisma.InputJsonValue,
        }),
      },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);
    return term;
  }

  async delete(quotationId: string, id: string, actorId: string) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const existing = await this.prisma.quotationTerm.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation term not found');

    await this.prisma.quotationTerm.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);

    return { id };
  }
}
