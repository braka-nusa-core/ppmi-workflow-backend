import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const idListSchema = z
  .array(z.string().min(1))
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'IDs must not contain duplicates',
  });

// Same shape as the H&M instalments, plus payment tracking. Only Cargo carries
// payment status here because it has no invoice/payment module behind it yet.
const cargoInstallmentSchema = z.object({
  installmentNo: z.number().int().positive(),
  percentage: z.number().min(0).max(100).optional(),
  dueAfterDays: z.number().int().nonnegative().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  dueDate: z.string().optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
  paidAt: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const cargoFieldsSchema = z.object({
  installments: z.array(cargoInstallmentSchema).optional(),
  interestInsured: z.string().optional(),
  voyageFrom: z.string().optional(),
  voyageTo: z.string().optional(),
  etd: z.string().optional(),
  eta: z.string().optional(),
  conveyance: z.string().optional(),
  instituteCargoClause: z
    .enum([
      'INSTITUTE_CARGO_A',
      'INSTITUTE_CARGO_B',
      'INSTITUTE_CARGO_C',
      'INSTITUTE_BULK_OIL',
      'INSTITUTE_COAL',
      'INSTITUTE_CARGO_AIR',
    ])
    .optional(),
  adjusterIds: idListSchema.optional(),
  surveyorIds: idListSchema.optional(),
});

export const createCargoQuotationSchema = cargoFieldsSchema;
export const updateCargoQuotationSchema = cargoFieldsSchema;

export class CreateCargoQuotationDto extends createZodDto(
  createCargoQuotationSchema,
) {}
export class UpdateCargoQuotationDto extends createZodDto(
  updateCargoQuotationSchema,
) {}
