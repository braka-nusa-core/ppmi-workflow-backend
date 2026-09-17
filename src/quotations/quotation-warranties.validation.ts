import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createQuotationWarrantySchema = z.object({
  warrantyId: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateQuotationWarrantySchema = z.object({
  warrantyId: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export class CreateQuotationWarrantyDto extends createZodDto(
  createQuotationWarrantySchema,
) {}
export class UpdateQuotationWarrantyDto extends createZodDto(
  updateQuotationWarrantySchema,
) {}
