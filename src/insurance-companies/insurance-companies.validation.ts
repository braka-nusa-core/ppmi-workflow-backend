import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const text = z.string().trim().min(1);

export const createInsuranceCompanySchema = z.object({
  code: text.transform((value) => value.toUpperCase()),
  name: text,
  address: text.optional(),
  phone: text.optional(),
  email: z.string().trim().email().optional(),
  contactPerson: text.optional(),
  status: text.optional(),
});

export const updateInsuranceCompanySchema = z.object({
  code: text.transform((value) => value.toUpperCase()).optional(),
  name: text.optional(),
  address: text.nullable().optional(),
  phone: text.nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  contactPerson: text.nullable().optional(),
  status: text.nullable().optional(),
});

export const listInsuranceCompaniesQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class CreateInsuranceCompanyDto extends createZodDto(
  createInsuranceCompanySchema,
) {}
export class UpdateInsuranceCompanyDto extends createZodDto(
  updateInsuranceCompanySchema,
) {}
export type ListInsuranceCompaniesQuery = z.infer<
  typeof listInsuranceCompaniesQuerySchema
>;
