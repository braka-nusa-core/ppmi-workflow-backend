import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const domainSchema = z.enum(['PNI', 'HULL_MACHINERY', 'CARGO']);
const coverTypeSchema = z.enum(['FULL', 'LIMITED']);
const text = z.string().trim().min(1);
// The template body (conditions, survey warranty, clauses, ...) is stored as
// JSON whose shape belongs to the frontend.
const contentSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

export const createQsTemplateSchema = z
  .object({
    name: text,
    templateVersion: text.optional(),
    templateDomain: domainSchema,
    clubId: z.string().min(1).optional(),
    coverType: coverTypeSchema.optional(),
    content: contentSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.templateDomain === 'PNI' && !value.clubId) {
      ctx.addIssue({
        code: 'custom',
        path: ['clubId'],
        message: 'clubId is required for a P&I template',
      });
    }
    if (value.templateDomain !== 'PNI' && (value.clubId || value.coverType)) {
      ctx.addIssue({
        code: 'custom',
        path: [value.clubId ? 'clubId' : 'coverType'],
        message: 'clubId and coverType only apply to P&I templates',
      });
    }
  });

// The domain is fixed once created: a template never moves between P&I, H&M,
// and Cargo.
export const updateQsTemplateSchema = z
  .object({
    name: text.optional(),
    templateVersion: text.nullable().optional(),
    clubId: z.string().min(1).optional(),
    coverType: coverTypeSchema.nullable().optional(),
    content: contentSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Send at least one field to update',
  });

export const listQsTemplatesQuerySchema = z.object({
  templateDomain: domainSchema.optional(),
  clubId: z.string().min(1).optional(),
  coverType: coverTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class CreateQsTemplateDto extends createZodDto(createQsTemplateSchema) {}
export class UpdateQsTemplateDto extends createZodDto(updateQsTemplateSchema) {}
export type ListQsTemplatesQuery = z.infer<typeof listQsTemplatesQuerySchema>;
