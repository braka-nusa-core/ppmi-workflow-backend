import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CargoService } from './cargo.service';
import { createCargoQuotationSchema } from './cargo.validation';

describe('CargoService installments', () => {
  const txMock = {
    cargoQuotationInstallment: { updateMany: vi.fn(), upsert: vi.fn() },
  };
  let service: CargoService;
  const sync = (installments: unknown[] | undefined) =>
    (service as any).syncInstallments(txMock, 'cargo-1', installments);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CargoService({} as any, {} as any);
  });

  it('leaves installments alone when none are sent', async () => {
    await sync(undefined);

    expect(txMock.cargoQuotationInstallment.updateMany).not.toHaveBeenCalled();
    expect(txMock.cargoQuotationInstallment.upsert).not.toHaveBeenCalled();
  });

  it('rejects duplicate installment numbers', async () => {
    await expect(
      sync([{ installmentNo: 1 }, { installmentNo: 1 }]),
    ).rejects.toThrow(BadRequestException);
  });

  it('soft deletes installments that are no longer sent', async () => {
    await sync([{ installmentNo: 1 }, { installmentNo: 2 }]);

    expect(txMock.cargoQuotationInstallment.updateMany).toHaveBeenCalledWith({
      where: {
        cargoQuotationId: 'cargo-1',
        deletedAt: null,
        installmentNo: { notIn: [1, 2] },
      },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('defaults to UNPAID without a payment date', async () => {
    await sync([{ installmentNo: 1, amount: 1000, currency: 'USD' }]);

    const call = txMock.cargoQuotationInstallment.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({
      installmentNo: 1,
      paymentStatus: 'UNPAID',
      paidAt: null,
      sortOrder: 0,
    });
  });

  it('stamps a payment date when an installment is PAID without one', async () => {
    await sync([{ installmentNo: 1, paymentStatus: 'PAID' }]);

    const call = txMock.cargoQuotationInstallment.upsert.mock.calls[0][0];
    expect(call.create.paidAt).toBeInstanceOf(Date);
    expect(call.update.paidAt).toBeInstanceOf(Date);
  });

  it('keeps the payment date that was sent and revives a deleted installment', async () => {
    await sync([
      { installmentNo: 3, paymentStatus: 'PAID', paidAt: '2026-10-01' },
    ]);

    const call = txMock.cargoQuotationInstallment.upsert.mock.calls[0][0];
    expect(call.create.paidAt.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(call.update.deletedAt).toBeNull();
    expect(call.where).toEqual({
      cargoQuotationId_installmentNo: {
        cargoQuotationId: 'cargo-1',
        installmentNo: 3,
      },
    });
  });
});

describe('createCargoQuotationSchema installments', () => {
  it('accepts a payment status and rejects an unknown one', () => {
    expect(
      createCargoQuotationSchema.parse({
        installments: [{ installmentNo: 1, paymentStatus: 'PAID' }],
      }).installments?.[0]?.paymentStatus,
    ).toBe('PAID');
    expect(() =>
      createCargoQuotationSchema.parse({
        installments: [{ installmentNo: 1, paymentStatus: 'LATE' }],
      }),
    ).toThrow();
  });
});
