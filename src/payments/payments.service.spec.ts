import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const prismaMock = {
    payment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    voucher: {
      findFirst: vi.fn(),
    },
    log: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const createBody = {
    voucher_id: 'vch-1',
    installment_number: 1,
    payment_date: '2026-06-10',
    due_date: '2026-07-10',
    paid_amount: 500,
    remaining_amount: 1000,
    payment_status: 'UNPAID',
    remarks: 'First installment',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (payload: any) => {
      if (Array.isArray(payload)) {
        return Promise.all(payload);
      }

      return payload(prismaMock);
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists payments with filters, pagination, and sorting', async () => {
    prismaMock.payment.findMany.mockResolvedValue([
      { id: 'pay-1', installment_number: 1 },
    ]);
    prismaMock.payment.count.mockResolvedValue(11);

    const result = await service.listPayments({
      voucher_id: 'vch-1',
      payment_status: 'unpaid',
      search: 'pay-1',
      page: '2',
      limit: '5',
      sort_by: 'paid_amount',
      sort_order: 'asc',
    });

    expect(prismaMock.payment.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { payment_status: 'UNPAID' },
          { voucher_id: 'vch-1' },
          {
            OR: [
              { id: { contains: 'pay-1', mode: 'insensitive' } },
              { remarks: { contains: 'pay-1', mode: 'insensitive' } },
            ],
          },
        ],
      },
      orderBy: { paid_amount: 'asc' },
      skip: 5,
      take: 5,
      include: {
        voucher: {
          select: {
            id: true,
            voucher_number: true,
          },
        },
      },
    });
    expect(result).toEqual({
      items: [{ id: 'pay-1', installment_number: 1 }],
      total_pages: 3,
      current_page: 2,
    });
  });

  it('rejects list when payment_status invalid', async () => {
    await expect(
      service.listPayments({ payment_status: 'invalid' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('gets payment detail when found', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      installment_number: 1,
    });

    const result = await service.getPayment('pay-1');

    expect(prismaMock.payment.findFirst).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      include: {
        voucher: {
          select: {
            id: true,
            voucher_number: true,
          },
        },
      },
    });
    expect(result).toEqual({ id: 'pay-1', installment_number: 1 });
  });

  it('rejects get when payment missing', async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);

    await expect(service.getPayment('pay-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects create when voucher missing', async () => {
    prismaMock.voucher.findFirst.mockResolvedValue(null);

    await expect(
      service.createPayment(createBody as any, 'Super Admin', 'admin-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates payment and writes log when valid', async () => {
    prismaMock.voucher.findFirst.mockResolvedValue({ id: 'vch-1' });
    prismaMock.payment.findFirst.mockResolvedValue(null);
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.createPayment(
      createBody as any,
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.stringMatching(/^PAY-\d{8}-\d{3}$/),
        voucher_id: 'vch-1',
        installment_number: 1,
      }),
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: {
        action: 'CREATE',
        reference_id: 'pay-1',
        reference_type: 'INVOICE',
        user_id: 'admin-1',
        description:
          'Super Admin created a new payment with installment number 1',
      },
    });
    expect(result).toEqual({ id: 'pay-1' });
  });

  it('rejects update when payment missing', async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);

    await expect(
      service.updatePayment(
        'pay-1',
        { remarks: 'Updated' } as any,
        'Admin',
        '1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects update when voucher missing', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      voucher_id: 'vch-1',
      installment_number: 1,
      payment_date: '2026-06-10',
      due_date: '2026-07-10',
      paid_amount: 500,
      remaining_amount: 1000,
      payment_status: 'UNPAID',
      remarks: 'First installment',
    });
    prismaMock.voucher.findFirst.mockResolvedValue(null);

    await expect(
      service.updatePayment(
        'pay-1',
        { voucher_id: 'vch-2' } as any,
        'Admin',
        '1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates payment and writes log when valid', async () => {
    const existing = {
      id: 'pay-1',
      voucher_id: 'vch-1',
      installment_number: 1,
      payment_date: '2026-06-10',
      due_date: '2026-07-10',
      paid_amount: 500,
      remaining_amount: 1000,
      payment_status: 'UNPAID',
      remarks: 'First installment',
    };

    prismaMock.payment.findFirst.mockResolvedValueOnce(existing);
    prismaMock.payment.update.mockResolvedValue({
      ...existing,
      remarks: 'Updated payment',
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.updatePayment(
      'pay-1',
      { remarks: 'Updated payment' } as any,
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: expect.objectContaining({
        remarks: 'Updated payment',
      }),
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'UPDATE',
        reference_id: 'pay-1',
        reference_type: 'INVOICE',
        user_id: 'admin-1',
      }),
    });
    expect(result).toEqual({
      ...existing,
      remarks: 'Updated payment',
    });
  });

  it('rejects delete when payment missing', async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);

    await expect(service.deletePayment('pay-1', 'Admin', '1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('hard deletes payment and writes log when valid', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      voucher_id: 'vch-1',
      installment_number: 1,
      payment_date: '2026-06-10',
      due_date: '2026-07-10',
      paid_amount: 500,
      remaining_amount: 1000,
      payment_status: 'UNPAID',
      remarks: 'First installment',
    });
    prismaMock.payment.delete.mockResolvedValue({ id: 'pay-1' });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.deletePayment(
      'pay-1',
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.payment.delete).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DELETE',
        reference_id: 'pay-1',
        reference_type: 'INVOICE',
        user_id: 'admin-1',
      }),
    });
    expect(result).toEqual({ id: 'pay-1' });
  });
});
