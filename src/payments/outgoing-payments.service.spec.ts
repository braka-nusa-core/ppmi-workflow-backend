import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { Prisma } from '../generated/prisma/client';
import { OutgoingPaymentsService } from './outgoing-payments.service';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('OutgoingPaymentsService', () => {
  let service: OutgoingPaymentsService;

  const prismaMock = {
    policy: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    policyParticipant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    outgoingPayment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    outgoingInstallment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const storageMock = { upload: vi.fn() };
  const actor = { id: 'user-1', fullname: 'Finance User' };

  const policy = { id: 'pol-1', quotationId: 'q-1', policyNumber: 'P-1' };
  const paymentRow = {
    id: 'out-1',
    amount: D('500'),
    status: 'WAITING_PAYMENT',
    policyParticipant: { insuranceCompany: { name: 'Insurer A' } },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OutgoingPaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();
    service = module.get(OutgoingPaymentsService);

    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.policy.findFirst.mockResolvedValue(policy);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'N',
      currency: 'USD',
      nettPremium: D('1000'),
    });
    prismaMock.outgoingInstallment.findMany.mockResolvedValue([]);
  });

  describe('list', () => {
    it('suggests share x nett premium, rounded to 2 decimals', async () => {
      prismaMock.policyParticipant.findMany.mockResolvedValue([
        {
          id: 'pp-1',
          share: D('33.33'),
          insuranceCompany: { id: 'c1', code: 'A', name: 'Insurer A' },
          outgoingPayments: [],
        },
      ]);

      const result = await service.list('pol-1');

      expect(prismaMock.policyParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { quotationId: 'q-1', deletedAt: null },
        }),
      );
      expect(result.participants[0].suggestedAmount?.toString()).toBe('333.3');
      expect(result.participants[0].outgoingPayment).toBeNull();
    });

    it('returns a null suggestion when the policy has no invoice', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue(null);
      prismaMock.policyParticipant.findMany.mockResolvedValue([
        {
          id: 'pp-1',
          share: D(50),
          insuranceCompany: { id: 'c1', code: 'A', name: 'A' },
          outgoingPayments: [],
        },
      ]);

      const result = await service.list('pol-1');
      expect(result.invoice).toBeNull();
      expect(result.participants[0].suggestedAmount).toBeNull();
    });

    it('rejects an unknown policy', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(null);
      await expect(service.list('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = { policyParticipantId: 'pp-1', amount: D('500') };

    it('rejects a participant from another policy', async () => {
      prismaMock.policyParticipant.findFirst.mockResolvedValue(null);
      await expect(service.create('pol-1', dto, actor)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.policyParticipant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pp-1', quotationId: 'q-1', deletedAt: null },
        }),
      );
    });

    it('allows only one outgoing payment per participant', async () => {
      prismaMock.policyParticipant.findFirst.mockResolvedValue({
        id: 'pp-1',
        insuranceCompany: { name: 'A' },
      });
      prismaMock.outgoingPayment.findFirst.mockResolvedValue({ id: 'out-1' });

      await expect(service.create('pol-1', dto, actor)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.outgoingPayment.create).not.toHaveBeenCalled();
    });

    it('creates WAITING_PAYMENT using the invoice currency by default', async () => {
      prismaMock.policyParticipant.findFirst.mockResolvedValue({
        id: 'pp-1',
        insuranceCompany: { name: 'A' },
      });
      prismaMock.outgoingPayment.findFirst.mockResolvedValue(null);
      prismaMock.outgoingPayment.create.mockResolvedValue({ id: 'out-1' });

      await service.create('pol-1', dto, actor);

      expect(prismaMock.outgoingPayment.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          status: 'WAITING_PAYMENT',
          currency: 'USD',
          policyParticipantId: 'pp-1',
        }),
      );
      expect(prismaMock.log.create.mock.calls[0][0].data.referenceType).toBe(
        'OUTGOING_PAYMENT',
      );
    });

    it('falls back to IDR without an invoice', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue(null);
      prismaMock.policyParticipant.findFirst.mockResolvedValue({
        id: 'pp-1',
        insuranceCompany: { name: 'A' },
      });
      prismaMock.outgoingPayment.findFirst.mockResolvedValue(null);
      prismaMock.outgoingPayment.create.mockResolvedValue({ id: 'out-1' });

      await service.create('pol-1', dto, actor);
      expect(
        prismaMock.outgoingPayment.create.mock.calls[0][0].data.currency,
      ).toBe('IDR');
    });
  });

  describe('update', () => {
    it('rejects an amount below what is already paid', async () => {
      prismaMock.outgoingPayment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.outgoingInstallment.findMany.mockResolvedValue([
        { amount: D('300') },
      ]);

      await expect(
        service.update('out-1', { amount: D('299.99') }, actor),
      ).rejects.toThrow('already paid');
    });

    it('recomputes the status after lowering the amount to the paid sum', async () => {
      // The second read happens inside the recompute, after the amount changed.
      prismaMock.outgoingPayment.findFirst
        .mockResolvedValueOnce(paymentRow)
        .mockResolvedValueOnce({ id: 'out-1', amount: D('300') });
      prismaMock.outgoingInstallment.findMany.mockResolvedValue([
        { amount: D('300') },
      ]);
      prismaMock.outgoingPayment.update.mockResolvedValue({ id: 'out-1' });

      await service.update('out-1', { amount: D('300') }, actor);

      expect(prismaMock.outgoingPayment.update).toHaveBeenLastCalledWith({
        where: { id: 'out-1' },
        data: { status: 'FULLY_PAID' },
      });
    });
  });

  describe('addInstallment', () => {
    it('rejects installments that exceed the amount', async () => {
      prismaMock.outgoingPayment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.outgoingInstallment.findMany.mockResolvedValue([
        { amount: D('400') },
      ]);

      await expect(
        service.addInstallment(
          'out-1',
          { amount: D('100.01'), paymentDate: new Date() },
          actor,
        ),
      ).rejects.toThrow('remaining amount');
    });

    it('numbers the installment and sets PARTIAL_PAYMENT', async () => {
      prismaMock.outgoingPayment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.outgoingInstallment.findFirst.mockResolvedValue({
        installmentOrder: 2,
      });
      prismaMock.outgoingInstallment.create.mockResolvedValue({
        id: 'ins-3',
        installmentOrder: 3,
      });
      // First read: before the write; second read: after it.
      prismaMock.outgoingInstallment.findMany
        .mockResolvedValueOnce([{ amount: D('100') }])
        .mockResolvedValueOnce([{ amount: D('100') }, { amount: D('50') }]);

      await service.addInstallment(
        'out-1',
        { amount: D('50'), paymentDate: new Date() },
        actor,
      );

      expect(
        prismaMock.outgoingInstallment.create.mock.calls[0][0].data
          .installmentOrder,
      ).toBe(3);
      expect(prismaMock.outgoingPayment.update).toHaveBeenCalledWith({
        where: { id: 'out-1' },
        data: { status: 'PARTIAL_PAYMENT' },
      });
    });

    it('sets FULLY_PAID when the installments reach the amount', async () => {
      prismaMock.outgoingPayment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.outgoingInstallment.findFirst.mockResolvedValue(null);
      prismaMock.outgoingInstallment.create.mockResolvedValue({
        installmentOrder: 1,
      });
      prismaMock.outgoingInstallment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ amount: D('500') }]);

      await service.addInstallment(
        'out-1',
        { amount: D('500'), paymentDate: new Date() },
        actor,
      );
      expect(prismaMock.outgoingPayment.update).toHaveBeenCalledWith({
        where: { id: 'out-1' },
        data: { status: 'FULLY_PAID' },
      });
    });
  });

  describe('installments', () => {
    it('soft deletes and returns the status to WAITING_PAYMENT', async () => {
      prismaMock.outgoingInstallment.findFirst.mockResolvedValue({
        id: 'ins-1',
        outgoingPaymentId: 'out-1',
        installmentOrder: 1,
      });
      prismaMock.outgoingPayment.findFirst.mockResolvedValue(paymentRow);

      await service.deleteInstallment('ins-1', actor);

      expect(
        prismaMock.outgoingInstallment.update.mock.calls[0][0].data.deletedAt,
      ).toBeInstanceOf(Date);
      expect(prismaMock.outgoingPayment.update).toHaveBeenCalledWith({
        where: { id: 'out-1' },
        data: { status: 'WAITING_PAYMENT' },
      });
    });

    it('stores proof under payments/outgoing/{id}/', async () => {
      prismaMock.outgoingInstallment.findFirst.mockResolvedValue({
        id: 'ins-1',
        outgoingPaymentId: 'out-1',
        installmentOrder: 1,
      });
      storageMock.upload.mockResolvedValue('https://s3/p.png');
      prismaMock.outgoingInstallment.update.mockResolvedValue({ id: 'ins-1' });

      await service.uploadInstallmentProof(
        'ins-1',
        {
          originalname: 'p.png',
          mimetype: 'image/png',
          buffer: Buffer.from('x'),
        } as Express.Multer.File,
        actor,
      );

      expect(storageMock.upload.mock.calls[0][0]).toMatch(
        /^payments\/outgoing\/ins-1\/.+\.png$/,
      );
    });
  });
});
