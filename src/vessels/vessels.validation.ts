import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const createVesselSchema = z.object({
  name: z.string().min(1),
  vesselType: z.string().min(1).optional(),
  builtYear: z.number().int().min(1800).max(currentYear + 1).optional(),
  grossTonnage: z.number().nonnegative().optional(),
  vesselClass: z.string().min(1).optional(),
});

export const updateVesselSchema = z.object({
  name: z.string().min(1).optional(),
  vesselType: z.string().min(1).nullable().optional(),
  builtYear: z
    .number()
    .int()
    .min(1800)
    .max(currentYear + 1)
    .nullable()
    .optional(),
  grossTonnage: z.number().nonnegative().nullable().optional(),
  vesselClass: z.string().min(1).nullable().optional(),
});

export const listVesselsQuerySchema = z.object({
  q: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class CreateVesselDto extends createZodDto(createVesselSchema) {}
export class UpdateVesselDto extends createZodDto(updateVesselSchema) {}
export type ListVesselsQuery = z.infer<typeof listVesselsQuerySchema>;
