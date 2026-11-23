import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import {
  computeInvoiceStatus,
  computeOutgoingStatus,
  recomputeInvoiceStatus,
  recomputeOutgoingStatus,
  round2,
  sumDecimals,
  paymentWords,
} from './payment.util';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('computeInvoiceStatus', () => {
  it('is UNPAID with no payments', () => {
    expect(computeInvoiceStatus(D(0), D(1000))).toBe('UNPAID');
  });

  it('is PARTIALLY_PAID below the balance due', () => {
    expect(computeInvoiceStatus(D('999.99'), D(1000))).toBe('PARTIALLY_PAID');
  });

  it('is PAID at or above the balance due', () => {
    expect(computeInvoiceStatus(D(1000), D(1000))).toBe('PAID');
    expect(computeInvoiceStatus(D('1000.01'), D(1000))).toBe('PAID');
  });
});

describe('computeOutgoingStatus', () => {
  it('maps paid amount to status', () => {
    expect(computeOutgoingStatus(D(0), D(500))).toBe('WAITING_PAYMENT');
    expect(computeOutgoingStatus(D(100), D(500))).toBe('PARTIAL_PAYMENT');
    expect(computeOutgoingStatus(D(500), D(500))).toBe('FULLY_PAID');
  });
});

describe('decimal helpers', () => {
  it('sums without float drift', () => {
    expect(sumDecimals(['0.1', '0.2', null]).toString()).toBe('0.3');
  });

  it('rounds half up to 2 decimals', () => {
    expect(round2(D('1.005')).toString()).toBe('1.01');
  });
});

describe('recomputeInvoiceStatus', () => {
  const makeTx = (amounts: string[], balanceDue: string | null) => ({
    invoice: {
      findFirst: vi.fn().mockResolvedValue({ id: 'inv-1', balanceDue }),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    incomingPayment: {
      findMany: vi
        .fn()
        .mockResolvedValue(amounts.map((amount) => ({ amount: D(amount) }))),
    },
    outgoingPayment: { findFirst: vi.fn(), update: vi.fn() },
    outgoingInstallment: { findMany: vi.fn() },
  });

  it('counts only non-deleted PAID payments', async () => {
    const tx = makeTx([], '1000');
    await recomputeInvoiceStatus(tx, 'inv-1');

    expect(tx.incomingPayment.findMany).toHaveBeenCalledWith({
      where: { invoiceId: 'inv-1', deletedAt: null, status: 'PAID' },
      select: { amount: true },
    });
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'UNPAID' },
    });
  });

  it('sets PARTIALLY_PAID then PAID as payments add up', async () => {
    const partial = makeTx(['400.50', '100'], '1000');
    await recomputeInvoiceStatus(partial, 'inv-1');
    expect(partial.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'PARTIALLY_PAID' },
    });

    const full = makeTx(['400.50', '599.50'], '1000');
    const result = await recomputeInvoiceStatus(full, 'inv-1');
    expect(result?.status).toBe('PAID');
  });

  it('does nothing when the invoice is missing', async () => {
    const tx = makeTx([], '1000');
    tx.invoice.findFirst.mockResolvedValue(null);
    expect(await recomputeInvoiceStatus(tx, 'x')).toBeNull();
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });
});

describe('recomputeOutgoingStatus', () => {
  const makeTx = (amounts: string[], amount: string) => ({
    invoice: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    incomingPayment: { findMany: vi.fn() },
    outgoingPayment: {
      findFirst: vi.fn().mockResolvedValue({ id: 'out-1', amount: D(amount) }),
      update: vi.fn(),
    },
    outgoingInstallment: {
      findMany: vi
        .fn()
        .mockResolvedValue(amounts.map((a) => ({ amount: D(a) }))),
    },
  });

  it.each([
    [[], 'WAITING_PAYMENT'],
    [['100'], 'PARTIAL_PAYMENT'],
    [['100', '400'], 'FULLY_PAID'],
  ])('installments %j give %s', async (amounts, expected) => {
    const tx = makeTx(amounts, '500');
    await recomputeOutgoingStatus(tx, 'out-1');

    expect(tx.outgoingInstallment.findMany).toHaveBeenCalledWith({
      where: { outgoingPaymentId: 'out-1', deletedAt: null },
      select: { amount: true },
    });
    expect(tx.outgoingPayment.update).toHaveBeenCalledWith({
      where: { id: 'out-1' },
      data: { status: expected },
    });
  });
});

describe('paymentWords', () => {
  it('uses the same wording as the invoice for IDR and USD', () => {
    expect(paymentWords(new Prisma.Decimal('43100195.25'), 'IDR')).toBe(
      'Forty-three million one hundred thousand one hundred ninety-five Indonesian Rupiah and twenty-five cents.',
    );
    expect(paymentWords('1', 'USD')).toBe('One US Dollar.');
  });

  it('returns null without an amount or for another currency', () => {
    expect(paymentWords(null, 'IDR')).toBeNull();
    expect(paymentWords('10', 'EUR')).toBeNull();
    expect(paymentWords('10', null)).toBeNull();
  });
});

describe('computeInvoiceStatus without a balance due', () => {
  it('never reports PAID for an invoice that has no total', () => {
    expect(computeInvoiceStatus(new Prisma.Decimal('100'), null)).toBe(
      'PARTIALLY_PAID',
    );
    expect(computeInvoiceStatus(new Prisma.Decimal('0'), null)).toBe('UNPAID');
  });
});
