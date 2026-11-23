import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import {
  Actor,
  lockInvoice,
  recomputeInvoiceStatus,
  sumPaidIncoming,
  toDecimal,
} from './payment.util';
import {
  CreateIncomingPaymentDto,
  UpdateIncomingPaymentDto,
} from './payments.validation';

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  balanceDue: Prisma.Decimal | null;
  currency: string;
};

@Injectable()
export class IncomingPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(invoiceId: string) {
    const invoice = await this.findInvoice(invoiceId);

    const payments = await this.prisma.incomingPayment.findMany({
      where: { invoiceId, deletedAt: null },
      include: { bank: { select: { id: true, name: true } } },
      orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
    });

    const paid = await sumPaidIncoming(this.prisma as any, invoiceId);
    const balanceDue = toDecimal(invoice.balanceDue);

    return {
      summary: {
        balanceDue,
        paid,
        remaining: balanceDue.minus(paid),
        status: invoice.status,
      },
      payments,
    };
  }

  async create(invoiceId: string, dto: CreateIncomingPaymentDto, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.findInvoice(invoiceId, tx);
      if (invoice.status === 'PAID') {
        throw new BadRequestException('Invoice is already fully paid');
      }
      await this.assertBank(dto.bankId, tx);

      await lockInvoice(tx as any, invoiceId);
      await this.assertWithinBalance(tx, invoice, dto.amount);

      const receiptNumber =
        dto.receiptNumber ?? (await this.generateReceiptNumber(tx));

      const payment = await tx.incomingPayment.create({
        data: {
          invoiceId,
          paymentDate: dto.paymentDate,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          bankId: dto.bankId,
          receiptNumber,
          notes: dto.notes,
          currency: invoice.currency,
          status: 'PAID',
          recordedById: actor.id,
        },
      });

      await recomputeInvoiceStatus(tx as any, invoiceId);
      await this.log(
        tx,
        'CREATE',
        payment.id,
        actor,
        `recorded incoming payment ${receiptNumber} of ${invoice.currency} ${toDecimal(dto.amount).toFixed(2)} for invoice ${invoice.invoiceNumber}`,
      );

      return payment;
    });
  }

  async uploadProof(id: string, file: Express.Multer.File, actor: Actor) {
    const payment = await this.findPayment(id);

    const key = `payments/incoming/${id}/${randomUUID()}${extname(file.originalname)}`;
    const proofOfPaymentUrl = await this.storage.upload(
      key,
      file.buffer,
      file.mimetype,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.incomingPayment.update({
        where: { id },
        data: { proofOfPaymentUrl },
      });
      await this.log(
        tx,
        'UPDATE',
        id,
        actor,
        `uploaded proof of payment ${file.originalname} for incoming payment ${payment.receiptNumber ?? id}`,
      );
      return updated;
    });
  }

  async update(id: string, dto: UpdateIncomingPaymentDto, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findPayment(id, tx);
      await this.assertBank(dto.bankId, tx);

      if (dto.amount !== undefined) {
        if (existing.status !== 'PAID') {
          throw new BadRequestException(
            'Amount of a refunded payment cannot be changed',
          );
        }
        await lockInvoice(tx as any, existing.invoiceId);
        const invoice = await this.findInvoice(existing.invoiceId, tx);
        await this.assertWithinBalance(tx, invoice, dto.amount, id);
      }

      const payment = await tx.incomingPayment.update({
        where: { id },
        data: {
          ...(dto.paymentDate !== undefined && {
            paymentDate: dto.paymentDate,
          }),
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.paymentMethod !== undefined && {
            paymentMethod: dto.paymentMethod,
          }),
          ...(dto.bankId !== undefined && { bankId: dto.bankId }),
          ...(dto.receiptNumber !== undefined && {
            receiptNumber: dto.receiptNumber,
          }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      });

      await recomputeInvoiceStatus(tx as any, existing.invoiceId);
      await this.log(
        tx,
        'UPDATE',
        id,
        actor,
        `updated incoming payment ${payment.receiptNumber ?? id}`,
      );

      return payment;
    });
  }

  async refund(id: string, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findPayment(id, tx);
      await lockInvoice(tx as any, existing.invoiceId);

      const { count } = await tx.incomingPayment.updateMany({
        where: { id, status: 'PAID', deletedAt: null },
        data: { status: 'REFUNDED' },
      });
      if (count === 0) {
        throw new BadRequestException('Payment is already refunded');
      }

      await recomputeInvoiceStatus(tx as any, existing.invoiceId);
      await this.log(
        tx,
        'UPDATE',
        id,
        actor,
        `refunded incoming payment ${existing.receiptNumber ?? id}`,
      );

      return { id, status: 'REFUNDED' };
    });
  }

  async delete(id: string, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findPayment(id, tx);
      await lockInvoice(tx as any, existing.invoiceId);

      await tx.incomingPayment.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await recomputeInvoiceStatus(tx as any, existing.invoiceId);
      await this.log(
        tx,
        'DELETE',
        id,
        actor,
        `deleted incoming payment ${existing.receiptNumber ?? id}`,
      );

      return { id };
    });
  }

  private async assertWithinBalance(
    tx: any,
    invoice: InvoiceRow,
    amount: Prisma.Decimal,
    excludePaymentId?: string,
  ) {
    if (invoice.balanceDue === null || invoice.balanceDue === undefined) {
      throw new BadRequestException('Invoice has no balance due');
    }
    const paid = await sumPaidIncoming(tx, invoice.id, excludePaymentId);
    const remaining = toDecimal(invoice.balanceDue).minus(paid);
    if (toDecimal(amount).gt(remaining)) {
      throw new BadRequestException(
        `Amount exceeds the remaining balance of ${remaining.toFixed(2)}`,
      );
    }
  }

  private async assertBank(bankId: string | null | undefined, tx: any) {
    if (!bankId) return;
    const bank = await tx.bank.findFirst({
      where: { id: bankId, deletedAt: null },
      select: { id: true },
    });
    if (!bank) throw new BadRequestException('Bank not found');
  }

  private async generateReceiptNumber(tx: any) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `RCPT-${y}${m}${d}-`;

    // Deleted payments are included so a number is never reused.
    const last = await tx.incomingPayment.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true },
    });
    const seq = last ? parseInt(last.receiptNumber.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  private async findInvoice(
    invoiceId: string,
    db: any = this.prisma,
  ): Promise<InvoiceRow> {
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        balanceDue: true,
        currency: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private async findPayment(id: string, db: any = this.prisma) {
    const payment = await db.incomingPayment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!payment) throw new NotFoundException('Incoming payment not found');
    return payment;
  }

  private log(
    tx: any,
    action: string,
    referenceId: string,
    actor: Actor,
    description: string,
  ) {
    return tx.log.create({
      data: {
        action,
        referenceId,
        referenceType: 'INCOMING_PAYMENT',
        userId: actor.id,
        description: `${actor.fullname} ${description}`,
      },
    });
  }
}
