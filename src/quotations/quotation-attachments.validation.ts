import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateQuotationAttachmentSchema = z.object({});

export class UpdateQuotationAttachmentDto extends createZodDto(
  updateQuotationAttachmentSchema,
) {}
