import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

type Actor = { id: string; fullname: string };

// What "MC" stands for is not confirmed with Finance. It is only the fallback
// for insurance types that have no InvoiceNumberSetting row.
export const DEFAULT_INVOICE_SUFFIX = 'MC';

@Injectable()
export class InvoiceNumbersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Next number for the month of `issueDate`: `{NNN}/{MM}-{YY}/PPMI/FIN/{suffix}`.
   * The sequence is shared by all insurance types and restarts every month.
   * Soft-deleted invoices count too, because the number stays unique.
   */
  async generate(issueDate: Date, insuranceTypeId?: string | null) {
    const month = String(issueDate.getUTCMonth() + 1).padStart(2, '0');
    const year = String(issueDate.getUTCFullYear() % 100).padStart(2, '0');
    const marker = `/${month}-${year}/PPMI/FIN/`;

    const existing = await this.prisma.invoice.findMany({
      where: { invoiceNumber: { contains: marker } },
      select: { invoiceNumber: true },
    });

    const markerRegex = new RegExp(`^(\\d+)${marker.replace(/[/-]/g, '\\$&')}`);
    let highest = 0;
    for (const { invoiceNumber } of existing) {
      const match = markerRegex.exec(invoiceNumber);
      if (match) highest = Math.max(highest, parseInt(match[1], 10));
    }

    const suffix = await this.suffixFor(insuranceTypeId);
    return `${String(highest + 1).padStart(3, '0')}${marker}${suffix}`;
  }

  async suffixFor(insuranceTypeId?: string | null) {
    if (!insuranceTypeId) return DEFAULT_INVOICE_SUFFIX;
    const setting = await this.prisma.invoiceNumberSetting.findUnique({
      where: { insuranceTypeId },
    });
    return setting?.suffix ?? DEFAULT_INVOICE_SUFFIX;
  }

  async listSettings() {
    const [types, settings] = await Promise.all([
      this.prisma.insuranceType.findMany({
        where: { deletedAt: null },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.invoiceNumberSetting.findMany(),
    ]);
    const byType = new Map(settings.map((s) => [s.insuranceTypeId, s.suffix]));

    return types.map((type) => ({
      insuranceTypeId: type.id,
      insuranceTypeCode: type.code,
      insuranceTypeName: type.name,
      suffix: byType.get(type.id) ?? DEFAULT_INVOICE_SUFFIX,
      isDefault: !byType.has(type.id),
    }));
  }

  async upsertSetting(insuranceTypeId: string, suffix: string, actor: Actor) {
    const type = await this.prisma.insuranceType.findFirst({
      where: { id: insuranceTypeId, deletedAt: null },
      select: { id: true, code: true },
    });
    if (!type) throw new NotFoundException('Insurance type not found');

    return this.prisma.$transaction(async (tx) => {
      const setting = await tx.invoiceNumberSetting.upsert({
        where: { insuranceTypeId },
        create: { insuranceTypeId, suffix },
        update: { suffix },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: insuranceTypeId,
          referenceType: 'INVOICE',
          userId: actor.id,
          description: `${actor.fullname} set the invoice number suffix of ${type.code} to ${suffix}`,
        },
      });

      return setting;
    });
  }
}
