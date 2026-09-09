import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createOrganizationSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(['DIVISION', 'DEPARTMENT']),
    parentId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'DEPARTMENT' && !data.parentId) return false;
      if (data.type === 'DIVISION' && data.parentId) return false;
      return true;
    },
    {
      message: 'DEPARTMENT requires parentId, DIVISION must not have parentId',
    },
  );

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['DIVISION', 'DEPARTMENT']).optional(),
  parentId: z.string().optional(),
});

export const createPermissionSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1),
  description: z.string().optional(),
});

export const updatePermissionSchema = z.object({
  description: z.string().optional(),
});

export const assignPermissionsSchema = z.object({
  permissionIds: z.array(z.string().min(1)).min(1),
});

export class CreateOrgDto extends createZodDto(createOrganizationSchema) {}
export class UpdateOrgDto extends createZodDto(updateOrganizationSchema) {}
export class CreatePermissionDto extends createZodDto(createPermissionSchema) {}
export class UpdatePermissionDto extends createZodDto(updatePermissionSchema) {}
export class AssignPermissionsDto extends createZodDto(
  assignPermissionsSchema,
) {}
