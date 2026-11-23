import { Prisma } from '../generated/prisma/client';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export type Actor = { id: string; fullname: string };

// Minimal slice of the transaction client these helpers need, so they can be
// unit tested without a real database.
type Tx = {
  invoice: {
    findFirst: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<any>;
  };
  incomingPayment: { findMany: (args: any) => Promise<any[]> };
  outgoingPayment: {
    findFirst: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  outgoingInstallment: { findMany: (args: any) => Promise<any[]> };
};

export const ZERO = new Decimal(0);

export function toDecimal(value: Decimal | string | number | null | undefined) {
  return value === null || value === undefined ? ZERO : new Decimal(value);
}

export function sumDecimals(
  values: Array<Decimal | string | number | null | undefined>,
) {
  return values.reduce<Decimal>((total, v) => total.plus(toDecimal(v)), ZERO);
}

export function round2(value: Decimal) {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export function computeInvoiceStatus(
  paid: Decimal,
  balanceDue: Decimal | string | number | null | undefined,
): InvoicePaymentStatus {
  if (paid.lte(0)) return 'UNPAID';
  return paid.lt(toDecimal(balanceDue)) ? 'PARTIALLY_PAID' : 'PAID';
}

export type OutgoingStatus =
  | 'WAITING_PAYMENT'
  | 'PARTIAL_PAYMENT'
  | 'FULLY_PAID';

export function computeOutgoingStatus(
  paid: Decimal,
  amount: Decimal | string | number | null | undefined,
): OutgoingStatus {
  if (paid.lte(0)) return 'WAITING_PAYMENT';
  return paid.lt(toDecimal(amount)) ? 'PARTIAL_PAYMENT' : 'FULLY_PAID';
}

// Takes a row lock on the invoice so two concurrent payments cannot both pass
// the balance check. Must run inside the transaction that writes the payment.
export async function lockInvoice(tx: Tx, invoiceId: string) {
  await tx.invoice.updateMany({
    where: { id: invoiceId },
    data: { updatedAt: new Date() },
  });
}

export async function sumPaidIncoming(
  tx: Tx,
  invoiceId: string,
  excludePaymentId?: string,
) {
  const payments = await tx.incomingPayment.findMany({
    where: {
      invoiceId,
      deletedAt: null,
      status: 'PAID',
      ...(excludePaymentId && { id: { not: excludePaymentId } }),
    },
    select: { amount: true },
  });
  return sumDecimals(payments.map((p) => p.amount));
}

// Recomputes the invoice status from the non-deleted PAID incoming payments.
// Call after every incoming payment write, inside the same transaction.
export async function recomputeInvoiceStatus(tx: Tx, invoiceId: string) {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId },
    select: { id: true, balanceDue: true },
  });
  if (!invoice) return null;

  const paid = await sumPaidIncoming(tx, invoiceId);
  const status = computeInvoiceStatus(paid, invoice.balanceDue);
  await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  return { paid, status };
}

export async function sumInstallments(
  tx: Tx,
  outgoingPaymentId: string,
  excludeInstallmentId?: string,
) {
  const installments = await tx.outgoingInstallment.findMany({
    where: {
      outgoingPaymentId,
      deletedAt: null,
      ...(excludeInstallmentId && { id: { not: excludeInstallmentId } }),
    },
    select: { amount: true },
  });
  return sumDecimals(installments.map((i) => i.amount));
}

// Recomputes the outgoing payment status from its non-deleted installments.
// Call after every outgoing payment or installment write, in the same transaction.
export async function recomputeOutgoingStatus(
  tx: Tx,
  outgoingPaymentId: string,
) {
  const payment = await tx.outgoingPayment.findFirst({
    where: { id: outgoingPaymentId },
    select: { id: true, amount: true },
  });
  if (!payment) return null;

  const paid = await sumInstallments(tx, outgoingPaymentId);
  const status = computeOutgoingStatus(paid, payment.amount);
  await tx.outgoingPayment.update({
    where: { id: outgoingPaymentId },
    data: { status },
  });
  return { paid, status };
}
