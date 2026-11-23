import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const text = z.string().trim().min(1);

// Same normalisation as VesselDocument.category so the two always match.
const code = text.transform((value) =>
  value.toUpperCase().replace(/\s+/g, '_'),
);

export const createVesselRequirementSchema = z.object({
  category: code,
  label: text.optional(),
  // Leave out for "every vessel".
  vesselType: text.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateVesselRequirementSchema = z.object({
  category: code.optional(),
  label: text.nullable().optional(),
  vesselType: text.nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export class CreateVesselRequirementDto extends createZodDto(
  createVesselRequirementSchema,
) {}
export class UpdateVesselRequirementDto extends createZodDto(
  updateVesselRequirementSchema,
) {}
