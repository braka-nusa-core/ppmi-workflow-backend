import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createQuotationTermSchema = z.object({
  termsConditionId: z.string().optional(),
  description: z.string().optional(),
});

export const updateQuotationTermSchema = z.object({
  termsConditionId: z.string().optional(),
  description: z.string().optional(),
});

export class CreateQuotationTermDto extends createZodDto(createQuotationTermSchema) {}
export class UpdateQuotationTermDto extends createZodDto(updateQuotationTermSchema) {}
