import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const INVOICE_CURRENCIES = ['IDR', 'USD'] as const;
export const INVOICE_STATUSES = [
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'INVOICE_ISSUED',
] as const;
export const INVOICE_DOCUMENT_TYPES = ['INVOICE_PDF', 'VOUCHER'] as const;

// Amounts arrive as number or string and stay strings, so no float is involved.
const decimalInput = (maxDecimals: number) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^\d+(\.\d+)?$/.test(value), {
      message: 'Must be a non-negative number',
    })
    .refine((value) => (value.split('.')[1] ?? '').length <= maxDecimals, {
      message: `Must have at most ${maxDecimals} decimal places`,
    });

const money = decimalInput(2);
const rate = decimalInput(4);
const text = z.string().trim().min(1).nullable().optional();

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1),
  policyNumber: text,
  voyageFrom: text,
  voyageTo: text,
  subjectInterest: text,
  sailingStart: z.coerce.date().nullable().optional(),
  sailingEnd: z.coerce.date().nullable().optional(),
  sumInsured: money.nullable().optional(),
  rate: rate.nullable().optional(),
  // Optional override. The server recomputes it when it is absent.
  total: money.nullable().optional(),
});

const invoiceFields = {
  invoiceNumber: z.string().trim().min(1).optional(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  paymentTermDays: z.number().int().min(0).max(365).default(14),
  currency: z.enum(INVOICE_CURRENCIES),
  insuranceTypeLabel: text,
  billToName: z.string().trim().min(1),
  billToAddress: text,
  coverName: text,
  items: z.array(invoiceItemSchema).min(1),
  discount: money.optional(),
  stampDutyPolicyCost: money.optional(),
  bankId: z.string().min(1).nullable().optional(),
  paymentDetail: text,
  notes: text,
  signerName: text,
  signerTitle: text,
};

export const createInvoiceSchema = z.object(invoiceFields);

// Every field optional; sent items replace all existing items.
export const updateInvoiceSchema = z.object({
  ...invoiceFields,
  invoiceNumber: invoiceFields.invoiceNumber,
  issueDate: invoiceFields.issueDate.optional(),
  paymentTermDays: z.number().int().min(0).max(365).optional(),
  currency: invoiceFields.currency.optional(),
  billToName: invoiceFields.billToName.optional(),
  items: invoiceFields.items.optional(),
});

export const listInvoicesQuerySchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  currency: z.enum(INVOICE_CURRENCIES).optional(),
  q: z.string().trim().min(1).optional(),
  requestInvoiceId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const upsertInvoiceNumberSettingSchema = z.object({
  suffix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,10}$/, 'Suffix must be 1-10 characters of A-Z or 0-9'),
});

// Multipart field, so it is always a string.
export const createInvoiceDocumentSchema = z.object({
  documentType: z.enum(INVOICE_DOCUMENT_TYPES),
});

export class CreateInvoiceDto extends createZodDto(createInvoiceSchema) {}
export class UpdateInvoiceDto extends createZodDto(updateInvoiceSchema) {}
export class UpsertInvoiceNumberSettingDto extends createZodDto(
  upsertInvoiceNumberSettingSchema,
) {}
export class CreateInvoiceDocumentDto extends createZodDto(
  createInvoiceDocumentSchema,
) {}
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
