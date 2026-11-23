import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Multipart form fields arrive as strings, so empty strings mean "not sent".
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());
const trimmedText = z.string().trim().min(1);

/** Shares are compared in integer hundredths, never as raw floats. */
export const toHundredths = (value: number | string | { toString(): string }) =>
  Math.round(Number(value.toString()) * 100);

export const PLACEMENT_TOTAL_HUNDREDTHS = 10_000;

const share = z
  .number()
  .gt(0, 'share must be greater than 0')
  .max(100, 'share must not exceed 100')
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    'share must have at most 2 decimals',
  );

const participantSchema = z.object({
  insuranceCompanyId: z.string().min(1),
  role: z.enum(['LEADER', 'MEMBER']),
  share,
  orderNo: z.number().int().min(1).optional(),
});

export const replacePlacementSchema = z
  .object({
    participants: z.array(participantSchema).min(1),
  })
  .superRefine(({ participants }, ctx) => {
    const leaders = participants.filter((item) => item.role === 'LEADER');
    if (leaders.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['participants'],
        message: 'Placement must have exactly one LEADER',
      });
    }

    const ids = participants.map((item) => item.insuranceCompanyId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['participants'],
        message: 'An insurance company can only appear once',
      });
    }

    const total = participants.reduce(
      (sum, item) => sum + toHundredths(item.share),
      0,
    );
    if (total !== PLACEMENT_TOTAL_HUNDREDTHS) {
      ctx.addIssue({
        code: 'custom',
        path: ['participants'],
        message: 'Total share must be exactly 100.00',
      });
    }
  });

const periodIsOrdered = (value: {
  periodStart?: Date | null;
  periodEnd?: Date | null;
}) =>
  !value.periodStart ||
  !value.periodEnd ||
  value.periodStart <= value.periodEnd;

const periodMessage = {
  message: 'periodEnd must not be earlier than periodStart',
  path: ['periodEnd'],
};

export const issuePolicySchema = z
  .object({
    policyNumber: z.preprocess(emptyToUndefined, trimmedText),
    policyDate: optionalDate,
    periodStart: optionalDate,
    periodEnd: optionalDate,
  })
  .refine(periodIsOrdered, periodMessage);

export const updatePolicySchema = z
  .object({
    policyNumber: trimmedText.optional(),
    policyDate: z.coerce.date().nullable().optional(),
    periodStart: z.coerce.date().nullable().optional(),
    periodEnd: z.coerce.date().nullable().optional(),
  })
  .refine(periodIsOrdered, periodMessage);

export const listPoliciesQuerySchema = z.object({
  status: z.enum(['POLICY_ISSUED', 'PLACEMENT_COMPLETED']).optional(),
  insuranceTypeId: z.string().min(1).optional(),
  quotationId: z.string().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class ReplacePlacementDto extends createZodDto(replacePlacementSchema) {}
export class IssuePolicyDto extends createZodDto(issuePolicySchema) {}
export class UpdatePolicyDto extends createZodDto(updatePolicySchema) {}
export type ListPoliciesQuery = z.infer<typeof listPoliciesQuerySchema>;
