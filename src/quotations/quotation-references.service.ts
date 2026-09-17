import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

@Injectable()
export class QuotationReferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTemplate(domain: 'HULL_MACHINERY' | 'CARGO') {
    const template = await this.prisma.qsTemplate.findFirst({
      where: { templateDomain: domain, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (!template) throw new NotFoundException('Quotation template not found');
    return template;
  }

  listAdjusters() {
    return this.prisma.adjuster.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  listSurveyors() {
    return this.prisma.surveyor.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }
}
