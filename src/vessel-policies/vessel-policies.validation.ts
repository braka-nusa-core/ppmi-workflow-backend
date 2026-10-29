import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const statusSchema = z.enum(['ON', 'NEW_VESSEL', 'OFF', 'CANCEL', 'SELL']);

const nullableDate = z.union([z.null(), z.coerce.date()]);

export const createVesselPolicySchema = z.object({
  vesselId: z.string().min(1),
  clientId: z.string().min(1),
  policyNumber: z.string().min(1).optional(),
  policyNumberRaw: z.string().optional(),
  insuredRaw: z.string().optional(),
  periodRaw: z.string().optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  clubCode: z.string().min(1).optional(),
  clubRaw: z.string().optional(),
  status: statusSchema.optional(),
  statusRaw: z.string().optional(),
});

export const updateVesselPolicySchema = z.object({
  clientId: z.string().min(1).optional(),
  policyNumber: z.string().min(1).nullable().optional(),
  policyNumberRaw: z.string().nullable().optional(),
  insuredRaw: z.string().nullable().optional(),
  periodRaw: z.string().nullable().optional(),
  periodStart: nullableDate.optional(),
  periodEnd: nullableDate.optional(),
  clubCode: z.string().min(1).nullable().optional(),
  clubRaw: z.string().nullable().optional(),
  status: statusSchema.nullable().optional(),
  statusRaw: z.string().nullable().optional(),
});

export const listVesselPoliciesQuerySchema = z.object({
  clientId: z.string().min(1).optional(),
  vesselId: z.string().min(1).optional(),
  status: statusSchema.optional(),
  expiringWithinDays: z.coerce.number().int().min(0).max(3650).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class CreateVesselPolicyDto extends createZodDto(
  createVesselPolicySchema,
) {}
export class UpdateVesselPolicyDto extends createZodDto(
  updateVesselPolicySchema,
) {}
export type ListVesselPoliciesQuery = z.infer<
  typeof listVesselPoliciesQuerySchema
>;
