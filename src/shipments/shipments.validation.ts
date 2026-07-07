import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createShipmentSchema = z.object({
  invoice_id: z.string().min(1),
  payment_id: z.string().min(1).optional(),
  courier: z.string().min(1),
  tracking_number: z.string().min(1),
  shipping_date: z.string().datetime(),
  shipping_proof_id: z.string().min(1).optional(),
});

export class CreateShipmentDto extends createZodDto(createShipmentSchema) {}

export const updateShipmentSchema = z.object({
  invoice_id: z.string().min(1).optional(),
  payment_id: z.string().min(1).optional(),
  courier: z.string().min(1).optional(),
  tracking_number: z.string().min(1).optional(),
  shipping_date: z.string().datetime().optional(),
  shipping_proof_id: z.string().min(1).optional(),
});

export class UpdateShipmentDto extends createZodDto(updateShipmentSchema) {}
