import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createQuotationObjectSchema = z.object({
  objectType: z.string().min(1),
  data: z.any().optional(),
});

export const updateQuotationObjectSchema = z.object({
  objectType: z.string().min(1).optional(),
  data: z.any().optional(),
});

export class CreateQuotationObjectDto extends createZodDto(createQuotationObjectSchema) {}
export class UpdateQuotationObjectDto extends createZodDto(updateQuotationObjectSchema) {}
