import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Action, ReferenceType } from './generated/prisma/enums';

export const createDivisionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export class CreateDivisionDto extends createZodDto(createDivisionSchema) {}

export const updateDivisionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export class UpdateDivisionDto extends createZodDto(updateDivisionSchema) {}

export const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export class CreateRoleDto extends createZodDto(createRoleSchema) {}

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export class UpdateRoleDto extends createZodDto(updateRoleSchema) {}

export const createBankSchema = z.object({
  name: z.string().min(1),
  account_number: z.string().min(1),
  account_name: z.string().min(1),
});

export class CreateBankDto extends createZodDto(createBankSchema) {}

export const updateBankSchema = z.object({
  name: z.string().min(1).optional(),
  account_number: z.string().min(1).optional(),
  account_name: z.string().min(1).optional(),
});

export class UpdateBankDto extends createZodDto(updateBankSchema) {}

export const updateUserSchema = z.object({
  fullname: z.string().min(2).optional(),
  email: z.email().optional(),
  password: z.string().min(6).optional(),
  phone: z.string().optional(),
  is_admin: z.boolean().optional(),
  divisions: z.array(z.uuid()).optional(),
  roles: z.array(z.uuid()).optional(),
});

export class UpdateUserDto extends createZodDto(updateUserSchema) {}

export interface DashboardStats {
  quotation_sheets: {
    total: number;
    active_this_month: number;
  };
  active_invoices: {
    total: number;
    pending_approval: number;
    trend_this_week: number;
  };
  pending_payments: {
    total: number;
    total_value: number;
  };
  overdue_payments: {
    total: number;
    trend_since_yesterday: number;
  };
  completed_shipments: {
    total: number;
    total_processed: number;
    trend_this_week: number;
  };
}

export interface WorkflowStageResult {
  stage: string;
  total: number;
  completed: number;
  pending: number;
  in_progress: number;
  overdue: number;
  completion_percentage: number;
}

export interface RecentActivityItem {
  id: string;
  title: string;
  division_code: string | null;
  reference_number: string | null;
  description: string;
  actor: string;
  action: Action;
  reference_type: ReferenceType | null;
  created_at: Date;
}
