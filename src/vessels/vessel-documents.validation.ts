import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Multipart form fields arrive as strings, so empty strings mean "not sent".
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalText = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);
const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

// Category is free text on purpose: the official list of vessel documents is
// not final yet. Values are normalised to upper case so filters stay reliable.
export const categorySchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase().replace(/\s+/g, '_'))
    .optional(),
);

const validityIsOrdered = (value: {
  validFrom?: Date | null;
  validUntil?: Date | null;
}) =>
  !value.validFrom || !value.validUntil || value.validFrom <= value.validUntil;

const validityMessage = {
  message: 'validUntil must not be earlier than validFrom',
  path: ['validUntil'],
};

export const createVesselDocumentSchema = z
  .object({
    category: categorySchema,
    title: optionalText,
    documentDate: optionalDate,
    validFrom: optionalDate,
    validUntil: optionalDate,
    status: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .min(1)
        .transform((value) => value.toUpperCase().replace(/\s+/g, '_'))
        .optional(),
    ),
    note: optionalText,
  })
  .refine(validityIsOrdered, validityMessage);

export const updateVesselDocumentSchema = z
  .object({
    category: categorySchema,
    title: z.string().trim().min(1).nullable().optional(),
    documentDate: z.coerce.date().nullable().optional(),
    validFrom: z.coerce.date().nullable().optional(),
    validUntil: z.coerce.date().nullable().optional(),
    status: categorySchema,
    note: z.string().trim().min(1).nullable().optional(),
  })
  .refine(validityIsOrdered, validityMessage);

export const listVesselDocumentsQuerySchema = z.object({
  category: categorySchema,
});

export class CreateVesselDocumentDto extends createZodDto(
  createVesselDocumentSchema,
) {}
export class UpdateVesselDocumentDto extends createZodDto(
  updateVesselDocumentSchema,
) {}
export type ListVesselDocumentsQuery = z.infer<
  typeof listVesselDocumentsQuerySchema
>;
