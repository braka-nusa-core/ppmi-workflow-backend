import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ENTITY_TYPES } from '../common/utils/entity-reference';

const entityTypeSchema = z.enum(ENTITY_TYPES);
const categorySchema = z.enum(['INTERNAL', 'EXTERNAL', 'INSURER', 'INSURED']);
const text = z.string().trim().min(1);

export const createAssignmentSchema = z
  .object({
    entityType: entityTypeSchema,
    entityId: z.string().min(1),
    category: categorySchema,
    // INTERNAL PICs are users; everyone else is described by contact details.
    userId: z.string().min(1).optional(),
    name: text.optional(),
    email: z.string().trim().email().optional(),
    phone: text.optional(),
    organizationName: text.optional(),
    role: text.optional(),
    note: text.optional(),
    startDate: z.coerce.date().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.category === 'INTERNAL') {
      if (!value.userId) {
        ctx.addIssue({
          code: 'custom',
          path: ['userId'],
          message: 'userId is required for an INTERNAL assignment',
        });
      }
    } else {
      if (value.userId) {
        ctx.addIssue({
          code: 'custom',
          path: ['userId'],
          message: 'userId is only allowed for an INTERNAL assignment',
        });
      }
      if (!value.name) {
        ctx.addIssue({
          code: 'custom',
          path: ['name'],
          message: 'name is required for a non-internal assignment',
        });
      }
    }
  });

// The person or entity of an assignment is fixed: to change it, end the
// assignment and create a new one so the history stays accurate.
export const updateAssignmentSchema = z.object({
  name: text.nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: text.nullable().optional(),
  organizationName: text.nullable().optional(),
  role: text.nullable().optional(),
  note: text.nullable().optional(),
});

export const listAssignmentsQuerySchema = z.object({
  entityType: entityTypeSchema.optional(),
  entityId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  category: categorySchema.optional(),
  includeEnded: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class CreateAssignmentDto extends createZodDto(createAssignmentSchema) {}
export class UpdateAssignmentDto extends createZodDto(updateAssignmentSchema) {}
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
