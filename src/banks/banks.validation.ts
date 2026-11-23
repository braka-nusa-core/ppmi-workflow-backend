import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const BANK_CURRENCIES = ['IDR', 'USD'] as const;

const optionalText = z.string().trim().min(1).nullable().optional();

export const createBankSchema = z.object({
  name: z.string().trim().min(1),
  accountNumber: optionalText,
  accountName: optionalText,
  branch: optionalText,
  currency: z.enum(BANK_CURRENCIES).nullable().optional(),
});

export const updateBankSchema = createBankSchema.partial();

export const listBanksQuerySchema = z.object({
  currency: z.enum(BANK_CURRENCIES).optional(),
  q: z.string().trim().min(1).optional(),
});

export class CreateBankDto extends createZodDto(createBankSchema) {}
export class UpdateBankDto extends createZodDto(updateBankSchema) {}
export type ListBanksQuery = z.infer<typeof listBanksQuerySchema>;
