import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const idListSchema = z
  .array(z.string().min(1))
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'IDs must not contain duplicates',
  });

const cargoFieldsSchema = z.object({
  interestInsured: z.string().optional(),
  voyageFrom: z.string().optional(),
  voyageTo: z.string().optional(),
  etd: z.string().optional(),
  eta: z.string().optional(),
  conveyance: z.string().optional(),
  instituteCargoClause: z
    .enum([
      'INSTITUTE_CARGO_A',
      'INSTITUTE_CARGO_B',
      'INSTITUTE_CARGO_C',
      'INSTITUTE_BULK_OIL',
      'INSTITUTE_COAL',
      'INSTITUTE_CARGO_AIR',
    ])
    .optional(),
  adjusterIds: idListSchema.optional(),
  surveyorIds: idListSchema.optional(),
});

export const createCargoQuotationSchema = cargoFieldsSchema;
export const updateCargoQuotationSchema = cargoFieldsSchema;

export class CreateCargoQuotationDto extends createZodDto(
  createCargoQuotationSchema,
) {}
export class UpdateCargoQuotationDto extends createZodDto(
  updateCargoQuotationSchema,
) {}
