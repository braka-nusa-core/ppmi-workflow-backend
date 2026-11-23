import { randomBytes } from 'crypto';
import { PrismaService } from '../../src/common/services/prisma.service';

export const integrationEnabled = !!process.env.TEST_DATABASE_URL;

/** Short random text so repeated runs never collide on unique columns. */
export const suffix = () => randomBytes(4).toString('hex');

export async function createUser(
  prisma: PrismaService,
  options: { role?: 'USER' | 'SUPERADMIN'; organizationUnitId?: string } = {},
) {
  return prisma.user.create({
    data: {
      fullname: `Integration User ${suffix()}`,
      email: `it.${suffix()}@test.local`,
      password: 'not-a-real-hash',
      role: options.role ?? 'USER',
      organizationUnitId: options.organizationUnitId,
    },
  });
}

/** Teknik (division) with P&I and Supervisor Teknik departments, created once. */
export async function ensureTechnicalUnits(prisma: PrismaService) {
  const teknik = await prisma.organizationUnit.upsert({
    where: { name_type: { name: 'Teknik', type: 'DIVISION' } },
    update: { deletedAt: null },
    create: { name: 'Teknik', type: 'DIVISION' },
  });
  const department = (name: string) =>
    prisma.organizationUnit.upsert({
      where: { name_type: { name, type: 'DEPARTMENT' } },
      update: { parentId: teknik.id, deletedAt: null },
      create: { name, type: 'DEPARTMENT', parentId: teknik.id },
    });

  return {
    teknik,
    pni: await department('P&I'),
    supervisor: await department('Supervisor Teknik'),
  };
}
