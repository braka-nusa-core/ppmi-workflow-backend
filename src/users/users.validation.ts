import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createUserSchema = z.object({
  fullname: z.string().min(1),
  email: z.email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  role: z.enum(['SUPERADMIN', 'USER']).optional().default('USER'),
  organization_unit_id: z.string().optional(),
});

export const updateUserSchema = z.object({
  fullname: z.string().min(1).optional(),
  email: z.email().optional(),
  password: z.string().min(6).optional(),
  phone: z.string().optional(),
  role: z.enum(['SUPERADMIN', 'USER']).optional(),
  organization_unit_id: z.string().optional(),
});

export class CreateUserDto extends createZodDto(createUserSchema) {}
export class UpdateUserDto extends createZodDto(updateUserSchema) {}
