import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const codeSchema = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[A-Z0-9_]+$/, 'Code may only contain A-Z, 0-9, and underscore');

export const createClubSchema = z.object({
  code: codeSchema,
  name: z.string().min(1),
});

export const updateClubSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().min(1).optional(),
});

export class CreateClubDto extends createZodDto(createClubSchema) {}
export class UpdateClubDto extends createZodDto(updateClubSchema) {}
