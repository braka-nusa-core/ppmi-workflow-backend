import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ENTITY_TYPES } from '../common/utils/entity-reference';

const id = z.string().min(1);
const text = z.string().trim().min(1);
const entityTypeSchema = z.enum(ENTITY_TYPES);
const followUpStatusSchema = z.enum(['OPEN', 'DONE', 'CANCELLED']);

const entityIsComplete = (value: {
  entityType?: unknown;
  entityId?: unknown;
}) => (value.entityType === undefined) === (value.entityId === undefined);

const entityMessage = {
  message: 'entityType and entityId must be sent together',
  path: ['entityId'],
};

// ---- Follow-ups ----------------------------------------------------------

const followUpInputSchema = z.object({
  title: text,
  description: text.optional(),
  assigneeId: id.optional(),
  dueDate: z.coerce.date().optional(),
});

export const createFollowUpSchema = z
  .object({
    meetingId: id.optional(),
    entityType: entityTypeSchema.optional(),
    entityId: id.optional(),
    title: text,
    description: text.optional(),
    assigneeId: id.optional(),
    dueDate: z.coerce.date().optional(),
  })
  .refine(entityIsComplete, entityMessage);

export const updateFollowUpSchema = z.object({
  title: text.optional(),
  description: text.nullable().optional(),
  assigneeId: id.nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: followUpStatusSchema.optional(),
});

export const listFollowUpsQuerySchema = z.object({
  meetingId: id.optional(),
  entityType: entityTypeSchema.optional(),
  entityId: id.optional(),
  assigneeId: id.optional(),
  status: followUpStatusSchema.optional(),
  dueBefore: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ---- Meetings ------------------------------------------------------------

export const createMeetingSchema = z
  .object({
    title: text,
    meetingDate: z.coerce.date(),
    location: text.optional(),
    // Free text: one participant per line, or whatever the team prefers.
    participants: text.optional(),
    agenda: text.optional(),
    outcome: text.optional(),
    entityType: entityTypeSchema.optional(),
    entityId: id.optional(),
    followUps: z.array(followUpInputSchema).optional(),
  })
  .refine(entityIsComplete, entityMessage);

export const updateMeetingSchema = z.object({
  title: text.optional(),
  meetingDate: z.coerce.date().optional(),
  location: text.nullable().optional(),
  participants: text.nullable().optional(),
  agenda: text.nullable().optional(),
  outcome: text.nullable().optional(),
});

export const listMeetingsQuerySchema = z.object({
  entityType: entityTypeSchema.optional(),
  entityId: id.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class CreateMeetingDto extends createZodDto(createMeetingSchema) {}
export class UpdateMeetingDto extends createZodDto(updateMeetingSchema) {}
export class CreateFollowUpDto extends createZodDto(createFollowUpSchema) {}
export class UpdateFollowUpDto extends createZodDto(updateFollowUpSchema) {}
export type ListMeetingsQuery = z.infer<typeof listMeetingsQuerySchema>;
export type ListFollowUpsQuery = z.infer<typeof listFollowUpsQuerySchema>;
