import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';

const MAX_AMOUNT = new Prisma.Decimal('9999999999999.99');

// Accepts a number or a numeric string and returns an exact Decimal.
export const moneySchema = z
  .union([z.number(), z.string().trim()])
  .refine(
    (value) => {
      try {
        const d = new Prisma.Decimal(value);
        return (
          d.isFinite() && d.gt(0) && d.lte(MAX_AMOUNT) && d.decimalPlaces() <= 2
        );
      } catch {
        return false;
      }
    },
    { message: 'amount must be greater than 0 with at most 2 decimals' },
  )
  .transform((value) => new Prisma.Decimal(value));

const text = z.string().trim().min(1);
const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'currency must be a 3 letter code')
  .transform((value) => value.toUpperCase());

export const createIncomingPaymentSchema = z.object({
  paymentDate: z.coerce.date(),
  amount: moneySchema,
  paymentMethod: text.optional(),
  bankId: z.string().min(1).optional(),
  receiptNumber: text.optional(),
  notes: text.optional(),
});

export const updateIncomingPaymentSchema = z.object({
  paymentDate: z.coerce.date().optional(),
  amount: moneySchema.optional(),
  paymentMethod: text.nullable().optional(),
  bankId: z.string().min(1).nullable().optional(),
  receiptNumber: text.nullable().optional(),
  notes: text.nullable().optional(),
});

export const createOutgoingPaymentSchema = z.object({
  policyParticipantId: z.string().min(1),
  amount: moneySchema,
  currency: currencySchema.optional(),
  notes: text.optional(),
});

export const updateOutgoingPaymentSchema = z.object({
  amount: moneySchema.optional(),
  currency: currencySchema.optional(),
  notes: text.nullable().optional(),
});

export const createOutgoingInstallmentSchema = z.object({
  amount: moneySchema,
  paymentDate: z.coerce.date(),
  notes: text.optional(),
});

export class CreateIncomingPaymentDto extends createZodDto(
  createIncomingPaymentSchema,
) {}
export class UpdateIncomingPaymentDto extends createZodDto(
  updateIncomingPaymentSchema,
) {}
export class CreateOutgoingPaymentDto extends createZodDto(
  createOutgoingPaymentSchema,
) {}
export class UpdateOutgoingPaymentDto extends createZodDto(
  updateOutgoingPaymentSchema,
) {}
export class CreateOutgoingInstallmentDto extends createZodDto(
  createOutgoingInstallmentSchema,
) {}
