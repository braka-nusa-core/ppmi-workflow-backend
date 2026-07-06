import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  Prisma,
  VoucherPaymentType,
  VoucherStatus,
} from '../generated/prisma/client';
import { CreateVoucherDto, UpdateVoucherDto } from './vouchers.validation';

@Injectable()
export class VouchersService {
  constructor(private readonly prismaService: PrismaService) {}

  private formatDateId(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  }

  async listVouchers(filters: {
    status?: string | string[];
    payment_type?: string | string[];
    bank_id?: string | string[];
    invoice_id?: string | string[];
    search?: string | string[];
    page?: string | string[];
    limit?: string | string[];
    sort_by?: string | string[];
    sort_order?: string | string[];
  }) {
    const toSingleValue = (value?: string | string[]) => {
      if (!value) {
        return undefined;
      }

      if (Array.isArray(value)) {
        return value.map((item) => item.trim()).find(Boolean);
      }

      return value.trim();
    };

    const normalizeEnum = <T extends string>(
      value: string | string[] | undefined,
      allowed: readonly T[],
      label: string,
    ) => {
      const normalizedValues = (Array.isArray(value) ? value : [value])
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);

      if (normalizedValues.some((item) => item.toUpperCase() === 'ALL')) {
        return undefined;
      }

      const normalized = normalizedValues[0];

      if (!normalized) {
        return undefined;
      }

      const upper = normalized.toUpperCase();

      if (!allowed.includes(upper as T)) {
        throw new BadRequestException(`Invalid ${label}`);
      }

      return upper as T;
    };

    const status = normalizeEnum(
      filters.status,
      Object.values(VoucherStatus),
      'status',
    );
    const paymentType = normalizeEnum(
      filters.payment_type,
      Object.values(VoucherPaymentType),
      'payment_type',
    );
    const bankId = toSingleValue(filters.bank_id);
    const invoiceId = toSingleValue(filters.invoice_id);
    const searchTerm = toSingleValue(filters.search);
    const pageRaw = toSingleValue(filters.page);
    const limitRaw = toSingleValue(filters.limit);
    const sortByRaw = toSingleValue(filters.sort_by);
    const sortOrderRaw = toSingleValue(filters.sort_order);

    const page = pageRaw ? Number(pageRaw) : 1;
    const limit = limitRaw ? Number(limitRaw) : 10;

    if (!Number.isFinite(page) || page < 1) {
      throw new BadRequestException('Invalid page');
    }

    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException('Invalid limit');
    }

    const sortBy = (sortByRaw ?? 'created_at').toLowerCase();
    const sortOrder = (sortOrderRaw ?? 'desc').toLowerCase();

    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
      throw new BadRequestException('Invalid sort_order');
    }

    const sortFieldMap: Record<
      string,
      keyof Prisma.VoucherOrderByWithRelationInput
    > = {
      voucher_id: 'id',
      id: 'id',
      voucher_number: 'voucher_number',
      amount: 'amount',
      voucher_date: 'voucher_date',
      created_at: 'created_at',
      updated_at: 'updated_at',
    };

    const sortField = sortFieldMap[sortBy];

    if (!sortField) {
      throw new BadRequestException('Invalid sort_by');
    }

    const AND: Prisma.VoucherWhereInput[] = [{ is_deleted: false }];

    if (status) {
      AND.push({ status });
    }

    if (paymentType) {
      AND.push({ payment_type: paymentType });
    }

    if (bankId) {
      AND.push({ bank_id: bankId });
    }

    if (invoiceId) {
      AND.push({ invoice_id: invoiceId });
    }

    if (searchTerm && searchTerm.length > 0) {
      AND.push({
        OR: [
          { id: { contains: searchTerm, mode: 'insensitive' } },
          { voucher_number: { contains: searchTerm, mode: 'insensitive' } },
          { currency: { contains: searchTerm, mode: 'insensitive' } },
          { remarks: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    const orderBy: Prisma.VoucherOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.voucher.findMany({
        where: { AND },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          invoice: {
            select: {
              id: true,
              invoice_number: true,
              insured: true,
              qs: {
                select: {
                  qs_id: true,
                  insured: true,
                  division: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          bank: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prismaService.voucher.count({ where: { AND } }),
    ]);

    return {
      items: items.map((item) => {
        const { invoice, ...rest } = item;

        return {
          ...rest,
          invoice: invoice
            ? {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                insured: invoice.insured,
              }
            : null,
          qs: invoice?.qs
            ? {
                qs_id: invoice.qs.qs_id,
                insured: invoice.qs.insured,
                division: invoice.qs.division ? invoice.qs.division.name : null,
              }
            : null,
        };
      }),
      total_pages: Math.ceil(total / limit),
      current_page: page,
    };
  }

  async getVoucher(id: string) {
    const voucher = await this.prismaService.voucher.findFirst({
      where: { id, is_deleted: false },
      include: {
        invoice: {
          select: {
            id: true,
            invoice_number: true,
            insured: true,
            qs: {
              select: {
                qs_id: true,
                insured: true,
                division: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        bank: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    const { invoice, ...rest } = voucher;

    return {
      ...rest,
      invoice: invoice
        ? {
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            insured: invoice.insured,
          }
        : null,
      qs: invoice?.qs
        ? {
            qs_id: invoice.qs.qs_id,
            insured: invoice.qs.insured,
            division: invoice.qs.division ? invoice.qs.division.name : null,
          }
        : null,
    };
  }

  async createVoucher(
    body: CreateVoucherDto,
    fullname: string,
    user_id: string,
  ) {
    const duplicate = await this.prismaService.voucher.findFirst({
      where: {
        voucher_number: body.voucher_number,
        is_deleted: false,
      },
    });

    if (duplicate) {
      throw new BadRequestException('Voucher number already exists');
    }

    const invoice = await this.prismaService.invoice.findFirst({
      where: {
        id: body.invoice_id,
        is_deleted: false,
      },
      select: {
        id: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const existingVoucher = await this.prismaService.voucher.findFirst({
      where: {
        invoice_id: body.invoice_id,
        is_deleted: false,
      },
    });

    if (existingVoucher) {
      throw new BadRequestException('Voucher already exists for this invoice');
    }

    if (body.bank_id) {
      const bank = await this.prismaService.bank.findFirst({
        where: {
          id: body.bank_id,
          is_deleted: false,
        },
        select: {
          id: true,
        },
      });

      if (!bank) {
        throw new NotFoundException('Bank not found');
      }
    }

    const datePart = this.formatDateId(new Date());
    const prefix = `VCH-${datePart}-`;

    const voucher = await this.prismaService.$transaction(async (prisma) => {
      const latest = await prisma.voucher.findFirst({
        where: {
          id: {
            startsWith: prefix,
          },
        },
        orderBy: {
          id: 'desc',
        },
        select: {
          id: true,
        },
      });

      const lastSequence = latest?.id
        ? Number(latest.id.slice(prefix.length))
        : 0;
      const nextSequence =
        Number.isFinite(lastSequence) && lastSequence > 0
          ? lastSequence + 1
          : 1;
      const voucherId = `${prefix}${String(nextSequence).padStart(3, '0')}`;

      const create = await prisma.voucher.create({
        data: {
          id: voucherId,
          invoice_id: body.invoice_id,
          voucher_number: body.voucher_number,
          voucher_date: body.voucher_date,
          payment_type: body.payment_type,
          bank_id: body.bank_id,
          amount: body.amount,
          currency: body.currency,
          status: body.status,
          remarks: body.remarks,
        },
      });

      await prisma.log.create({
        data: {
          action: 'CREATE',
          reference_id: create.id,
          reference_type: 'INVOICE',
          user_id,
          description: `${fullname} created a new voucher with number ${body.voucher_number}`,
        },
      });

      return create;
    });

    return voucher;
  }

  async updateVoucher(
    id: string,
    body: UpdateVoucherDto,
    fullname: string,
    user_id: string,
  ) {
    const existing = await this.prismaService.voucher.findFirst({
      where: { id, is_deleted: false },
    });

    if (!existing) {
      throw new NotFoundException('Voucher not found');
    }

    const nextVoucherNumber = body.voucher_number ?? existing.voucher_number;

    if (
      body.voucher_number &&
      body.voucher_number !== existing.voucher_number
    ) {
      const duplicate = await this.prismaService.voucher.findFirst({
        where: {
          id: { not: id },
          voucher_number: nextVoucherNumber,
          is_deleted: false,
        },
      });

      if (duplicate) {
        throw new BadRequestException('Voucher number already exists');
      }
    }

    const nextInvoiceId = body.invoice_id ?? existing.invoice_id;

    if (body.invoice_id && body.invoice_id !== existing.invoice_id) {
      const invoice = await this.prismaService.invoice.findFirst({
        where: {
          id: body.invoice_id,
          is_deleted: false,
        },
        select: {
          id: true,
        },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      const duplicateInvoice = await this.prismaService.voucher.findFirst({
        where: {
          id: { not: id },
          invoice_id: nextInvoiceId,
          is_deleted: false,
        },
      });

      if (duplicateInvoice) {
        throw new BadRequestException(
          'Voucher already exists for this invoice',
        );
      }
    }

    if (body.bank_id) {
      const bank = await this.prismaService.bank.findFirst({
        where: {
          id: body.bank_id,
          is_deleted: false,
        },
        select: {
          id: true,
        },
      });

      if (!bank) {
        throw new NotFoundException('Bank not found');
      }
    }

    const voucher = await this.prismaService.$transaction(async (prisma) => {
      const update = await prisma.voucher.update({
        where: { id },
        data: {
          invoice_id: body.invoice_id,
          voucher_number: body.voucher_number,
          voucher_date: body.voucher_date,
          payment_type: body.payment_type,
          bank_id: body.bank_id,
          amount: body.amount,
          currency: body.currency,
          status: body.status,
          remarks: body.remarks,
        },
      });

      await prisma.log.create({
        data: {
          action: 'UPDATE',
          reference_id: id,
          reference_type: 'INVOICE',
          user_id,
          description: `${fullname} updated voucher number ${existing.voucher_number}`,
          details: JSON.stringify({
            before: {
              invoice_id: existing.invoice_id,
              voucher_number: existing.voucher_number,
              voucher_date: existing.voucher_date,
              payment_type: existing.payment_type,
              bank_id: existing.bank_id,
              amount: existing.amount,
              currency: existing.currency,
              status: existing.status,
              remarks: existing.remarks,
              is_deleted: existing.is_deleted,
            },
            after: {
              invoice_id: update.invoice_id,
              voucher_number: update.voucher_number,
              voucher_date: update.voucher_date,
              payment_type: update.payment_type,
              bank_id: update.bank_id,
              amount: update.amount,
              currency: update.currency,
              status: update.status,
              remarks: update.remarks,
              is_deleted: update.is_deleted,
            },
          }),
        },
      });

      return update;
    });

    return voucher;
  }

  async deleteVoucher(id: string, fullname: string, user_id: string) {
    const existing = await this.prismaService.voucher.findFirst({
      where: { id, is_deleted: false },
    });

    if (!existing) {
      throw new NotFoundException('Voucher not found');
    }

    const deletedAt = new Date();

    const voucher = await this.prismaService.$transaction(async (prisma) => {
      const update = await prisma.voucher.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: deletedAt,
        },
      });

      await prisma.log.create({
        data: {
          action: 'DELETE',
          reference_id: id,
          reference_type: 'INVOICE',
          user_id,
          description: `${fullname} deleted voucher ${existing.voucher_number}`,
          details: JSON.stringify({
            before: {
              voucher_number: existing.voucher_number,
              is_deleted: existing.is_deleted,
              deleted_at: existing.deleted_at,
            },
            after: {
              is_deleted: true,
              deleted_at: deletedAt,
            },
          }),
        },
      });

      return update;
    });

    return voucher;
  }
}
