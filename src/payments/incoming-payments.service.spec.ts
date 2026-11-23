import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { Prisma } from '../generated/prisma/client';
import { IncomingPaymentsService } from './incoming-payments.service';
import { createIncomingPaymentSchema } from './payments.validation';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('IncomingPaymentsService', () => {
  let service: IncomingPaymentsService;

  const prismaMock = {
    invoice: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    incomingPayment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    bank: { findFirst: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const storageMock = { upload: vi.fn() };
  const actor = { id: 'user-1', fullname: 'Finance User' };

  const invoice = {
    id: 'inv-1',
    invoiceNumber: '001/11-26/PPMI/FIN/MC',
    status: 'UNPAID',
    balanceDue: D('1000'),
    currency: 'USD',
  };

  // The paid sum the mocked database returns for the next read.
  const paidBefore = (...amounts: string[]) =>
    prismaMock.incomingPayment.findMany.mockResolvedValue(
      amounts.map((a) => ({ amount: D(a) })),
    );

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IncomingPaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();
    service = module.get(IncomingPaymentsService);

    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.invoice.findFirst.mockResolvedValue(invoice);
    prismaMock.incomingPayment.create.mockResolvedValue({ id: 'pay-1' });
    paidBefore();
  });

  const dto = (amount: string) =>
    createIncomingPaymentSchema.parse({
      paymentDate: '2026-11-24',
      amount,
    });

  describe('create', () => {
    it('rejects an unknown invoice', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue(null);
      await expect(service.create('x', dto('10'), actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an invoice that is already paid', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue({
        ...invoice,
        status: 'PAID',
      });
      await expect(service.create('inv-1', dto('10'), actor)).rejects.toThrow(
        'already fully paid',
      );
    });

    it('rejects an amount above the remaining balance', async () => {
      paidBefore('900');
      await expect(
        service.create('inv-1', dto('100.01'), actor),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.incomingPayment.create).not.toHaveBeenCalled();
    });

    it('accepts an amount equal to the remaining balance and recomputes', async () => {
      // Read before the write (900 paid), then after it (1000 paid).
      prismaMock.incomingPayment.findMany
        .mockResolvedValueOnce([{ amount: D('900') }])
        .mockResolvedValueOnce([{ amount: D('900') }, { amount: D('100') }]);
      prismaMock.incomingPayment.findFirst.mockResolvedValue(null);

      await service.create('inv-1', dto('100'), actor);

      const data = prismaMock.incomingPayment.create.mock.calls[0][0].data;
      expect(data.currency).toBe('USD');
      expect(data.status).toBe('PAID');
      expect(data.recordedById).toBe('user-1');
      expect(data.receiptNumber).toMatch(/^RCPT-\d{8}-001$/);
      // Status was recomputed in the same transaction.
      expect(prismaMock.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'PAID' },
      });
      expect(prismaMock.log.create.mock.calls[0][0].data.referenceType).toBe(
        'INCOMING_PAYMENT',
      );
    });

    it('continues the receipt sequence and keeps a given number', async () => {
      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      prismaMock.incomingPayment.findFirst.mockResolvedValue({
        receiptNumber: `RCPT-${ymd}-004`,
      });
      await service.create('inv-1', dto('10'), actor);
      expect(
        prismaMock.incomingPayment.create.mock.calls[0][0].data.receiptNumber,
      ).toBe(`RCPT-${ymd}-005`);

      await service.create(
        'inv-1',
        createIncomingPaymentSchema.parse({
          paymentDate: '2026-11-24',
          amount: 10,
          receiptNumber: 'MANUAL-1',
        }),
        actor,
      );
      expect(
        prismaMock.incomingPayment.create.mock.calls[1][0].data.receiptNumber,
      ).toBe('MANUAL-1');
    });

    it('rejects an unknown bank', async () => {
      prismaMock.bank.findFirst.mockResolvedValue(null);
      await expect(
        service.create(
          'inv-1',
          createIncomingPaymentSchema.parse({
            paymentDate: '2026-11-24',
            amount: 10,
            bankId: 'nope',
          }),
          actor,
        ),
      ).rejects.toThrow('Bank not found');
    });
  });

  describe('amount validation', () => {
    it.each(['0', '-5', '10.123', 'abc', ''])('rejects %j', (amount) => {
      expect(
        createIncomingPaymentSchema.safeParse({
          paymentDate: '2026-11-24',
          amount,
        }).success,
      ).toBe(false);
    });

    it('accepts numbers and strings with 2 decimals', () => {
      expect(
        createIncomingPaymentSchema
          .parse({
            paymentDate: '2026-11-24',
            amount: 10.5,
          })
          .amount.toString(),
      ).toBe('10.5');
    });
  });

  describe('update', () => {
    it('excludes the payment itself from the balance check', async () => {
      prismaMock.incomingPayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        status: 'PAID',
      });
      prismaMock.incomingPayment.update.mockResolvedValue({ id: 'pay-1' });

      await service.update('pay-1', { amount: D('1000') }, actor);

      expect(prismaMock.incomingPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 'pay-1' } }),
        }),
      );
    });

    it('rejects an amount above the remaining balance', async () => {
      prismaMock.incomingPayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        status: 'PAID',
      });
      paidBefore('500');
      await expect(
        service.update('pay-1', { amount: D('500.01') }, actor),
      ).rejects.toThrow('remaining balance');
    });

    it('does not change the amount of a refunded payment', async () => {
      prismaMock.incomingPayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        status: 'REFUNDED',
      });
      await expect(
        service.update('pay-1', { amount: D('1') }, actor),
      ).rejects.toThrow('refunded');
    });
  });

  describe('refund and delete', () => {
    it('refunds a PAID payment and recomputes the invoice', async () => {
      prismaMock.incomingPayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
      });
      prismaMock.incomingPayment.updateMany.mockResolvedValue({ count: 1 });

      await service.refund('pay-1', actor);

      expect(prismaMock.incomingPayment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', status: 'PAID', deletedAt: null },
        data: { status: 'REFUNDED' },
      });
      expect(prismaMock.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'UNPAID' },
      });
    });

    it('rejects refunding twice', async () => {
      prismaMock.incomingPayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
      });
      prismaMock.incomingPayment.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.refund('pay-1', actor)).rejects.toThrow(
        'already refunded',
      );
    });

    it('soft deletes and recomputes the invoice', async () => {
      prismaMock.incomingPayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
      });
      paidBefore('400');

      await service.delete('pay-1', actor);

      expect(
        prismaMock.incomingPayment.update.mock.calls[0][0].data.deletedAt,
      ).toBeInstanceOf(Date);
      expect(prismaMock.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'PARTIALLY_PAID' },
      });
    });
  });

  describe('uploadProof', () => {
    it('stores the file under payments/incoming/{id}/', async () => {
      prismaMock.incomingPayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        receiptNumber: 'R1',
      });
      storageMock.upload.mockResolvedValue('https://s3/proof.pdf');
      prismaMock.incomingPayment.update.mockResolvedValue({ id: 'pay-1' });

      await service.uploadProof(
        'pay-1',
        {
          originalname: 'bukti.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('x'),
        } as Express.Multer.File,
        actor,
      );

      expect(storageMock.upload.mock.calls[0][0]).toMatch(
        /^payments\/incoming\/pay-1\/.+\.pdf$/,
      );
      expect(prismaMock.incomingPayment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { proofOfPaymentUrl: 'https://s3/proof.pdf' },
      });
    });
  });

  describe('list', () => {
    it('returns the balance summary', async () => {
      prismaMock.incomingPayment.findMany
        .mockResolvedValueOnce([{ id: 'pay-1' }])
        .mockResolvedValueOnce([{ amount: D('250.5') }]);

      const result = await service.list('inv-1');

      expect(result.summary.balanceDue.toString()).toBe('1000');
      expect(result.summary.paid.toString()).toBe('250.5');
      expect(result.summary.remaining.toString()).toBe('749.5');
      expect(result.summary.status).toBe('UNPAID');
    });
  });
});
