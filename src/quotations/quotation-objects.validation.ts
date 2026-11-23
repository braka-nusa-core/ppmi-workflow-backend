import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createQuotationObjectSchema = z.object({
  objectType: z.string().min(1),
  // Optional link to the vessel master (used by H&M and Cargo objects, and any
  // other object that is a vessel).
  vesselId: z.string().min(1).optional(),
  data: z.any().optional(),
});

export const updateQuotationObjectSchema = z.object({
  objectType: z.string().min(1).optional(),
  vesselId: z.string().min(1).nullable().optional(),
  data: z.any().optional(),
});

export class CreateQuotationObjectDto extends createZodDto(
  createQuotationObjectSchema,
) {}
export class UpdateQuotationObjectDto extends createZodDto(
  updateQuotationObjectSchema,
) {}
