import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createQuotationCoverageSchema = z.object({
  coverageType: z.string().optional(),
  description: z.string().optional(),
  value: z.number().optional(),
});

export const updateQuotationCoverageSchema = z.object({
  coverageType: z.string().optional(),
  description: z.string().optional(),
  value: z.number().optional(),
});

export class CreateQuotationCoverageDto extends createZodDto(createQuotationCoverageSchema) {}
export class UpdateQuotationCoverageDto extends createZodDto(updateQuotationCoverageSchema) {}
