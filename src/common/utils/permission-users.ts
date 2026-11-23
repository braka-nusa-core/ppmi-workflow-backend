import { PrismaService } from '../services/prisma.service';

/**
 * Mirrors PermissionGuard: a permission granted to a unit also applies to
 * the users of its child units. SUPERADMIN always qualifies.
 */
export async function usersWithPermission(
  prisma: PrismaService,
  resource: string,
  action: string,
): Promise<string[]> {
  const units = await prisma.organizationUnit.findMany({
    where: {
      deletedAt: null,
      permissions: {
        some: { permission: { resource, action, deletedAt: null } },
      },
    },
    select: { id: true, children: { select: { id: true } } },
  });
  const unitIds = units.flatMap((unit) => [
    unit.id,
    ...unit.children.map((child) => child.id),
  ]);

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { role: 'SUPERADMIN' },
        ...(unitIds.length > 0
          ? [{ organizationUnitId: { in: unitIds } }]
          : []),
      ],
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}
