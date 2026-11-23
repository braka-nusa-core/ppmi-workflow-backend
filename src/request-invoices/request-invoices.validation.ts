import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  REQUEST_INVOICE_DOCUMENT_TYPES,
  REQUEST_INVOICE_STATUSES,
} from './request-invoices.constants';

// Multipart form fields arrive as strings, so empty strings mean "not sent".
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const text = z.string().trim().min(1);

export const createRequestInvoiceSchema = z.object({
  notes: text.optional(),
});

export const updateRequestInvoiceSchema = z.object({
  notes: text.nullable().optional(),
});

export const uploadRequestInvoiceDocumentSchema = z.object({
  documentType: z.preprocess(
    emptyToUndefined,
    z.enum(REQUEST_INVOICE_DOCUMENT_TYPES),
  ),
});

export const approveRequestInvoiceSchema = z.object({
  notes: text.optional(),
});

export const returnRequestInvoiceSchema = z.object({
  notes: text,
});

export const listRequestInvoicesQuerySchema = z.object({
  status: z.enum(REQUEST_INVOICE_STATUSES).optional(),
  policyId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class CreateRequestInvoiceDto extends createZodDto(
  createRequestInvoiceSchema,
) {}
export class UpdateRequestInvoiceDto extends createZodDto(
  updateRequestInvoiceSchema,
) {}
export class UploadRequestInvoiceDocumentDto extends createZodDto(
  uploadRequestInvoiceDocumentSchema,
) {}
export class ApproveRequestInvoiceDto extends createZodDto(
  approveRequestInvoiceSchema,
) {}
export class ReturnRequestInvoiceDto extends createZodDto(
  returnRequestInvoiceSchema,
) {}
export type ListRequestInvoicesQuery = z.infer<
  typeof listRequestInvoicesQuerySchema
>;
