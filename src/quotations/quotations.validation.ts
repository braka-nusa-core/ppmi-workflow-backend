import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const inlineClientSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  contactPerson: z.string().optional(),
});

export const createQuotationSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    client: inlineClientSchema.optional(),
    insuranceTypeId: z.string().min(1),
    insured: z.string().optional(),
    address: z.string().optional(),
    quotationDate: z.string().optional(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    interest: z.string().optional(),
    rate: z.number().optional(),
    premium: z.number().optional(),
    deductible: z.number().optional(),
    brokerage: z.number().optional(),
    templateVersion: z.string().optional(),
  })
  .refine((data) => data.clientId || data.client, {
    message: 'Either clientId or client object is required',
  })
  .refine((data) => !(data.clientId && data.client), {
    message: 'Provide either clientId or client object, not both',
  });

export const updateQuotationSchema = z.object({
  clientId: z.string().min(1).optional(),
  insuranceTypeId: z.string().min(1).optional(),
  insured: z.string().optional(),
  address: z.string().optional(),
  quotationDate: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  interest: z.string().optional(),
  rate: z.number().optional(),
  premium: z.number().optional(),
  deductible: z.number().optional(),
  brokerage: z.number().optional(),
  templateVersion: z.string().optional(),
});

export const actionNoteSchema = z.object({
  note: z.string().optional(),
});

export class CreateQuotationDto extends createZodDto(createQuotationSchema) {}
export class UpdateQuotationDto extends createZodDto(updateQuotationSchema) {}
export class ActionNoteDto extends createZodDto(actionNoteSchema) {}
