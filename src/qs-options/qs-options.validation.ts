import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// "premium warranty", "Premium-Warranty" -> PREMIUM_WARRANTY
export const normalizeGroup = (value: string) =>
  value
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();

const groupSchema = z
  .string()
  .trim()
  .min(1)
  .transform(normalizeGroup)
  .pipe(z.string().regex(/^[A-Z0-9_]+$/, 'group must be upper snake case'));
const valueSchema = z.string().trim().min(1);
const labelSchema = z.string().trim().min(1);

export const listQsOptionsQuerySchema = z.object({
  group: groupSchema,
});

export const createQsOptionSchema = z.object({
  group: groupSchema,
  value: valueSchema,
  label: labelSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateQsOptionSchema = z
  .object({
    value: valueSchema.optional(),
    label: labelSchema.nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one update field is required',
  });

export type ListQsOptionsQuery = z.infer<typeof listQsOptionsQuerySchema>;

export class CreateQsOptionDto extends createZodDto(createQsOptionSchema) {}
export class UpdateQsOptionDto extends createZodDto(updateQsOptionSchema) {}
