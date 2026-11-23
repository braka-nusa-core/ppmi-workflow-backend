import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { categorySchema as codeSchema } from './vessel-documents.validation';

const id = z.string().min(1);
const text = z.string().trim().min(1);

const surveyDateIsBeforeExpiry = (value: {
  surveyDate?: Date | null;
  validUntil?: Date | null;
}) =>
  !value.surveyDate ||
  !value.validUntil ||
  value.surveyDate <= value.validUntil;

const expiryMessage = {
  message: 'validUntil must not be earlier than surveyDate',
  path: ['validUntil'],
};

// Status and survey type are free text for now (PLANNED, NOMINATED, DONE...):
// the final list has not been agreed with the business.
export const createVesselSurveySchema = z
  .object({
    surveyorId: id.optional(),
    quotationId: id.optional(),
    surveyType: text.optional(),
    status: codeSchema,
    nominatedAt: z.coerce.date().optional(),
    surveyDate: z.coerce.date().optional(),
    reportDate: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    reportDocumentId: id.optional(),
    note: text.optional(),
  })
  .refine(surveyDateIsBeforeExpiry, expiryMessage);

export const updateVesselSurveySchema = z
  .object({
    surveyorId: id.nullable().optional(),
    quotationId: id.nullable().optional(),
    surveyType: text.nullable().optional(),
    status: codeSchema,
    nominatedAt: z.coerce.date().nullable().optional(),
    surveyDate: z.coerce.date().nullable().optional(),
    reportDate: z.coerce.date().nullable().optional(),
    validUntil: z.coerce.date().nullable().optional(),
    reportDocumentId: id.nullable().optional(),
    note: text.nullable().optional(),
  })
  .refine(surveyDateIsBeforeExpiry, expiryMessage);

export const listVesselSurveysQuerySchema = z.object({
  status: codeSchema,
});

export class CreateVesselSurveyDto extends createZodDto(
  createVesselSurveySchema,
) {}
export class UpdateVesselSurveyDto extends createZodDto(
  updateVesselSurveySchema,
) {}
export type ListVesselSurveysQuery = z.infer<
  typeof listVesselSurveysQuerySchema
>;
