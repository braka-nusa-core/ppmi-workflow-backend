import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const quotationTermFields = {
  section: z.enum(['TERMS_CONDITIONS', 'ADJUSTER_SURVEYOR']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isSelected: z.boolean().optional(),
  isEditable: z.boolean().optional(),
  isRemovable: z.boolean().optional(),
  selectionGroup: z.string().min(1).optional(),
  conditionRule: z.record(z.string(), z.unknown()).optional(),
};

export const createQuotationTermSchema = z.object({
  termsConditionId: z.string().optional(),
  description: z.string().optional(),
  ...quotationTermFields,
});

export const updateQuotationTermSchema = z.object({
  termsConditionId: z.string().optional(),
  description: z.string().optional(),
  ...quotationTermFields,
});

export class CreateQuotationTermDto extends createZodDto(
  createQuotationTermSchema,
) {}
export class UpdateQuotationTermDto extends createZodDto(
  updateQuotationTermSchema,
) {}
