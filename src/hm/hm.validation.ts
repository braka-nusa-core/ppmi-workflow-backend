import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const idListSchema = z
  .array(z.string().min(1))
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'IDs must not contain duplicates',
  });

const installmentSchema = z.object({
  installmentNo: z.number().int().positive(),
  percentage: z.number().min(0).max(100).optional(),
  dueAfterDays: z.number().int().nonnegative().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  dueDate: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const hmFieldsSchema = z.object({
  vesselType: z.string().optional(),
  tradingWarranty: z.string().optional(),
  premiumPaymentEnabled: z.boolean().optional(),
  brokerageEnabled: z.boolean().optional(),
  installments: z.array(installmentSchema).optional(),
  adjusterIds: idListSchema.optional(),
  surveyorIds: idListSchema.optional(),
});

export const createHmQuotationSchema = hmFieldsSchema;
export const updateHmQuotationSchema = hmFieldsSchema;

export class CreateHmQuotationDto extends createZodDto(
  createHmQuotationSchema,
) {}
export class UpdateHmQuotationDto extends createZodDto(
  updateHmQuotationSchema,
) {}
