import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Multipart form fields arrive as strings, so empty strings mean "not sent".
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const text = z.string().trim().min(1);

export const createShipmentSchema = z.object({
  courier: text.optional(),
  trackingNumber: text.optional(),
  shipmentDate: z.coerce.date().optional(),
  receiver: text.optional(),
  notes: text.optional(),
});

export const updateShipmentSchema = z.object({
  courier: text.nullable().optional(),
  trackingNumber: text.nullable().optional(),
  shipmentDate: z.coerce.date().nullable().optional(),
  receiver: text.nullable().optional(),
  notes: text.nullable().optional(),
});

export const deliverShipmentSchema = z.object({
  receivedDate: z.coerce.date(),
  receiver: text.optional(),
});

export const createShipmentDocumentSchema = z.object({
  documentType: z.preprocess(emptyToUndefined, text),
});

export const listShipmentsQuerySchema = z.object({
  status: z.enum(['SHIPPED', 'DELIVERED', 'COMPLETED']).optional(),
  invoiceId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class CreateShipmentDto extends createZodDto(createShipmentSchema) {}
export class UpdateShipmentDto extends createZodDto(updateShipmentSchema) {}
export class DeliverShipmentDto extends createZodDto(deliverShipmentSchema) {}
export class CreateShipmentDocumentDto extends createZodDto(
  createShipmentDocumentSchema,
) {}
export type ListShipmentsQuery = z.infer<typeof listShipmentsQuerySchema>;
