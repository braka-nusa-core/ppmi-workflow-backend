import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createInsuranceTypeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateInsuranceTypeSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export class CreateInsuranceTypeDto extends createZodDto(
  createInsuranceTypeSchema,
) {}
export class UpdateInsuranceTypeDto extends createZodDto(
  updateInsuranceTypeSchema,
) {}
