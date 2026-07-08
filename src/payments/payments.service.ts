import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { PaymentStatus, Prisma } from '../generated/prisma/client';
import { CreatePaymentDto, UpdatePaymentDto } from './payments.validation';

@Injectable()
export class PaymentsService {
  constructor(private readonly prismaService: PrismaService) {}

  private formatDateId(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  }

  async listPayments(filters: {
    voucher_id?: string | string[];
    payment_status?: string | string[];
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

    const paymentStatus = normalizeEnum(
      filters.payment_status,
      Object.values(PaymentStatus),
      'payment_status',
    );
    const voucherId = toSingleValue(filters.voucher_id);
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
      keyof Prisma.PaymentOrderByWithRelationInput
    > = {
      payment_id: 'id',
      id: 'id',
      installment_number: 'installment_number',
      paid_amount: 'paid_amount',
      remaining_amount: 'remaining_amount',
      payment_date: 'payment_date',
      due_date: 'due_date',
      created_at: 'created_at',
      updated_at: 'updated_at',
    };

    const sortField = sortFieldMap[sortBy];

    if (!sortField) {
      throw new BadRequestException('Invalid sort_by');
    }

    const AND: Prisma.PaymentWhereInput[] = [];

    if (paymentStatus) {
      AND.push({ payment_status: paymentStatus });
    }

    if (voucherId) {
      AND.push({ voucher_id: voucherId });
    }

    if (searchTerm && searchTerm.length > 0) {
      AND.push({
        OR: [
          { id: { contains: searchTerm, mode: 'insensitive' } },
          { remarks: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.PaymentWhereInput = AND.length > 0 ? { AND } : {};

    const orderBy: Prisma.PaymentOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.payment.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          voucher: {
            select: {
              id: true,
              voucher_number: true,
              invoice_id: true,
            },
          },
        },
      }),
      this.prismaService.payment.count({ where }),
    ]);

    return {
      items,
      total_pages: Math.ceil(total / limit),
      current_page: page,
    };
  }

  async getPayment(id: string) {
    const payment = await this.prismaService.payment.findFirst({
      where: { id },
      include: {
        voucher: {
          select: {
            id: true,
            voucher_number: true,
            invoice_id: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async createPayment(
    body: CreatePaymentDto,
    fullname: string,
    user_id: string,
  ) {
    const voucher = await this.prismaService.voucher.findFirst({
      where: {
        id: body.voucher_id,
        is_deleted: false,
      },
      select: {
        id: true,
      },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    const datePart = this.formatDateId(new Date());
    const prefix = `PAY-${datePart}-`;

    const payment = await this.prismaService.$transaction(async (prisma) => {
      const latest = await prisma.payment.findFirst({
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
      const paymentId = `${prefix}${String(nextSequence).padStart(3, '0')}`;

      const create = await prisma.payment.create({
        data: {
          id: paymentId,
          voucher_id: body.voucher_id,
          installment_number: body.installment_number,
          payment_date: body.payment_date,
          due_date: body.due_date,
          paid_amount: body.paid_amount,
          remaining_amount: body.remaining_amount,
          payment_status: body.payment_status,
          payment_proof: body.payment_proof,
          remarks: body.remarks,
        },
      });

      await prisma.log.create({
        data: {
          action: 'CREATE',
          reference_id: create.id,
          reference_type: 'INVOICE',
          user_id,
          description: `${fullname} created a new payment with installment number ${body.installment_number}`,
        },
      });

      return create;
    });

    return payment;
  }

  async updatePayment(
    id: string,
    body: UpdatePaymentDto,
    fullname: string,
    user_id: string,
  ) {
    const existing = await this.prismaService.payment.findFirst({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    if (body.voucher_id && body.voucher_id !== existing.voucher_id) {
      const voucher = await this.prismaService.voucher.findFirst({
        where: {
          id: body.voucher_id,
          is_deleted: false,
        },
        select: {
          id: true,
        },
      });

      if (!voucher) {
        throw new NotFoundException('Voucher not found');
      }
    }

    const payment = await this.prismaService.$transaction(async (prisma) => {
      const update = await prisma.payment.update({
        where: { id },
        data: {
          voucher_id: body.voucher_id,
          installment_number: body.installment_number,
          payment_date: body.payment_date,
          due_date: body.due_date,
          paid_amount: body.paid_amount,
          remaining_amount: body.remaining_amount,
          payment_status: body.payment_status,
          payment_proof: body.payment_proof,
          remarks: body.remarks,
        },
      });

      await prisma.log.create({
        data: {
          action: 'UPDATE',
          reference_id: id,
          reference_type: 'INVOICE',
          user_id,
          description: `${fullname} updated payment ${existing.id}`,
          details: JSON.stringify({
            before: {
              voucher_id: existing.voucher_id,
              installment_number: existing.installment_number,
              payment_date: existing.payment_date,
              due_date: existing.due_date,
              paid_amount: existing.paid_amount,
              remaining_amount: existing.remaining_amount,
              payment_status: existing.payment_status,
              remarks: existing.remarks,
            },
            after: {
              voucher_id: update.voucher_id,
              installment_number: update.installment_number,
              payment_date: update.payment_date,
              due_date: update.due_date,
              paid_amount: update.paid_amount,
              remaining_amount: update.remaining_amount,
              payment_status: update.payment_status,
              remarks: update.remarks,
            },
          }),
        },
      });

      return update;
    });

    return payment;
  }

  async deletePayment(id: string, fullname: string, user_id: string) {
    const existing = await this.prismaService.payment.findFirst({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    const payment = await this.prismaService.$transaction(async (prisma) => {
      const deleted = await prisma.payment.delete({
        where: { id },
      });

      await prisma.log.create({
        data: {
          action: 'DELETE',
          reference_id: id,
          reference_type: 'INVOICE',
          user_id,
          description: `${fullname} deleted payment ${existing.id}`,
          details: JSON.stringify({
            before: {
              voucher_id: existing.voucher_id,
              installment_number: existing.installment_number,
              payment_date: existing.payment_date,
              due_date: existing.due_date,
              paid_amount: existing.paid_amount,
              remaining_amount: existing.remaining_amount,
              payment_status: existing.payment_status,
              remarks: existing.remarks,
            },
          }),
        },
      });

      return deleted;
    });

    return payment;
  }
}
