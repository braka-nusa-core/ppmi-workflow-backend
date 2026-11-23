import { hashPassword } from '../src/utils/bcrypt.util';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function main() {
  console.log('Seeding...');

  const password = await hashPassword('password123');

  const teknik = await prisma.organizationUnit.upsert({
    where: { name_type: { name: 'Teknik', type: 'DIVISION' } },
    update: { deletedAt: null },
    create: { name: 'Teknik', type: 'DIVISION' },
  });

  const cargo = await prisma.organizationUnit.upsert({
    where: { name_type: { name: 'Cargo', type: 'DEPARTMENT' } },
    update: { parentId: teknik.id, deletedAt: null },
    create: { name: 'Cargo', type: 'DEPARTMENT', parentId: teknik.id },
  });

  const pi = await prisma.organizationUnit.upsert({
    where: { name_type: { name: 'P&I', type: 'DEPARTMENT' } },
    update: { parentId: teknik.id, deletedAt: null },
    create: { name: 'P&I', type: 'DEPARTMENT', parentId: teknik.id },
  });

  const hm = await prisma.organizationUnit.upsert({
    where: { name_type: { name: 'H&M', type: 'DEPARTMENT' } },
    update: { parentId: teknik.id, deletedAt: null },
    create: { name: 'H&M', type: 'DEPARTMENT', parentId: teknik.id },
  });

  // The approval flow checks for exactly this unit name under the Teknik division.
  const supervisorTeknik = await prisma.organizationUnit.upsert({
    where: { name_type: { name: 'Supervisor Teknik', type: 'DEPARTMENT' } },
    update: { parentId: teknik.id, deletedAt: null },
    create: {
      name: 'Supervisor Teknik',
      type: 'DEPARTMENT',
      parentId: teknik.id,
    },
  });

  const finance = await prisma.organizationUnit.upsert({
    where: { name_type: { name: 'Finance', type: 'DIVISION' } },
    update: { deletedAt: null },
    create: { name: 'Finance', type: 'DIVISION' },
  });

  const financeDepartment = await prisma.organizationUnit.upsert({
    where: { name_type: { name: 'Finance', type: 'DEPARTMENT' } },
    update: { parentId: finance.id, deletedAt: null },
    create: {
      name: 'Finance',
      type: 'DEPARTMENT',
      parentId: finance.id,
    },
  });

  const qsPermissions = [
    { action: 'read', description: 'View quotation slips' },
    { action: 'create', description: 'Create quotation slips' },
    { action: 'update', description: 'Update quotation slips' },
    { action: 'submit', description: 'Submit quotation slips' },
    { action: 'approve', description: 'Approve quotation slips' },
    {
      action: 'send-to-insurance',
      description: 'Send quotation slips to insurance companies',
    },
    {
      action: 'record-insurer-review',
      description: 'Record insurer review results',
    },
    { action: 'export', description: 'Export quotation slips' },
  ];

  const permissions = [];
  for (const permission of qsPermissions) {
    const savedPermission = await prisma.permission.upsert({
      where: {
        resource_action: { resource: 'quotation', action: permission.action },
      },
      update: {
        description: permission.description,
        deletedAt: null,
      },
      create: {
        resource: 'quotation',
        action: permission.action,
        description: permission.description,
      },
    });

    permissions.push(savedPermission);
  }

  await prisma.organizationUnitPermission.createMany({
    data: permissions.map((permission) => ({
      organizationUnitId: teknik.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  const masterDataPermissions = [
    {
      resource: 'client',
      action: 'read',
      description: 'View clients',
      assignToTeknik: true,
    },
    {
      resource: 'client',
      action: 'create',
      description: 'Create clients',
      assignToTeknik: true,
    },
    {
      resource: 'client',
      action: 'update',
      description: 'Update clients',
      assignToTeknik: true,
    },
    {
      resource: 'client',
      action: 'delete',
      description: 'Delete clients',
      assignToTeknik: true,
    },
    {
      resource: 'insurance-type',
      action: 'read',
      description: 'View insurance types',
      assignToTeknik: true,
    },
    {
      resource: 'insurance-type',
      action: 'create',
      description: 'Create insurance types',
      assignToTeknik: true,
    },
    {
      resource: 'insurance-type',
      action: 'update',
      description: 'Update insurance types',
      assignToTeknik: true,
    },
    {
      resource: 'insurance-type',
      action: 'delete',
      description: 'Delete insurance types',
      assignToTeknik: true,
    },
    {
      resource: 'club',
      action: 'read',
      description: 'View clubs',
      assignToTeknik: true,
    },
    {
      resource: 'club',
      action: 'create',
      description: 'Create clubs',
      assignToTeknik: true,
    },
    {
      resource: 'club',
      action: 'update',
      description: 'Update clubs',
      assignToTeknik: true,
    },
    {
      resource: 'club',
      action: 'delete',
      description: 'Delete clubs',
      assignToTeknik: true,
    },
    {
      resource: 'vessel',
      action: 'read',
      description: 'View vessels',
      assignToTeknik: true,
    },
    {
      resource: 'vessel',
      action: 'create',
      description: 'Create vessels',
      assignToTeknik: true,
    },
    {
      resource: 'vessel',
      action: 'update',
      description: 'Update vessels',
      assignToTeknik: true,
    },
    {
      resource: 'vessel',
      action: 'delete',
      description: 'Delete vessels',
      assignToTeknik: true,
    },
    {
      resource: 'vessel-policy',
      action: 'read',
      description: 'View vessel policies',
      assignToTeknik: true,
    },
    {
      resource: 'vessel-policy',
      action: 'create',
      description: 'Create vessel policies',
      assignToTeknik: true,
    },
    {
      resource: 'vessel-policy',
      action: 'update',
      description: 'Update vessel policies',
      assignToTeknik: true,
    },
    {
      resource: 'vessel-policy',
      action: 'delete',
      description: 'Delete vessel policies',
      assignToTeknik: true,
    },
    {
      resource: 'assignment',
      action: 'read',
      description: 'View PIC assignments',
      assignToTeknik: true,
    },
    {
      resource: 'assignment',
      action: 'create',
      description: 'Create PIC assignments',
      assignToTeknik: true,
    },
    {
      resource: 'assignment',
      action: 'update',
      description: 'Update PIC assignments',
      assignToTeknik: true,
    },
    {
      resource: 'assignment',
      action: 'delete',
      description: 'End PIC assignments',
      assignToTeknik: true,
    },
    {
      resource: 'meeting',
      action: 'read',
      description: 'View meetings and follow-ups',
      assignToTeknik: true,
    },
    {
      resource: 'meeting',
      action: 'create',
      description: 'Create meetings and follow-ups',
      assignToTeknik: true,
    },
    {
      resource: 'meeting',
      action: 'update',
      description: 'Update meetings and follow-ups',
      assignToTeknik: true,
    },
    {
      resource: 'meeting',
      action: 'delete',
      description: 'Delete meetings and follow-ups',
      assignToTeknik: true,
    },
  ];

  const masterDataReadPermissions = [];
  for (const permission of masterDataPermissions) {
    const savedPermission = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
      update: {
        description: permission.description,
        deletedAt: null,
      },
      create: {
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      },
    });

    if (permission.assignToTeknik) {
      masterDataReadPermissions.push(savedPermission);
    }
  }

  await prisma.organizationUnitPermission.createMany({
    data: masterDataReadPermissions.map((permission) => ({
      organizationUnitId: teknik.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  // Policy to shipment: Teknik works up to the Request for Invoice, Finance
  // takes over from the RFI review onwards.
  const workflowPermissions: {
    resource: string;
    actions: string[];
    teknik: string[];
    finance: string[];
  }[] = [
    {
      resource: 'insurance-company',
      actions: ['read', 'create', 'update', 'delete'],
      teknik: ['read', 'create', 'update', 'delete'],
      finance: ['read'],
    },
    {
      resource: 'policy',
      actions: ['read', 'create', 'update'],
      teknik: ['read', 'create', 'update'],
      finance: ['read'],
    },
    {
      resource: 'request-invoice',
      actions: ['read', 'create', 'update', 'submit', 'review'],
      teknik: ['read', 'create', 'update', 'submit'],
      finance: ['read', 'review'],
    },
    {
      resource: 'bank',
      actions: ['read', 'create', 'update', 'delete'],
      teknik: ['read'],
      finance: ['read', 'create', 'update', 'delete'],
    },
    {
      resource: 'invoice',
      actions: ['read', 'create', 'update'],
      teknik: [],
      finance: ['read', 'create', 'update'],
    },
    {
      resource: 'payment',
      actions: ['read', 'create', 'update'],
      teknik: [],
      finance: ['read', 'create', 'update'],
    },
    {
      resource: 'shipment',
      actions: ['read', 'create', 'update'],
      teknik: [],
      finance: ['read', 'create', 'update'],
    },
    {
      resource: 'qs-option',
      actions: ['read', 'create', 'update', 'delete'],
      teknik: ['read', 'create', 'update', 'delete'],
      finance: [],
    },
    {
      resource: 'qs-template',
      actions: ['read', 'create', 'update', 'delete'],
      teknik: ['read', 'create', 'update', 'delete'],
      finance: [],
    },
  ];

  for (const group of workflowPermissions) {
    for (const action of group.actions) {
      const saved = await prisma.permission.upsert({
        where: { resource_action: { resource: group.resource, action } },
        update: { deletedAt: null },
        create: {
          resource: group.resource,
          action,
          description: `${action} ${group.resource}`,
        },
      });

      const units = [
        ...(group.teknik.includes(action) ? [teknik.id] : []),
        ...(group.finance.includes(action) ? [finance.id] : []),
      ];
      await prisma.organizationUnitPermission.createMany({
        data: units.map((organizationUnitId) => ({
          organizationUnitId,
          permissionId: saved.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  // Insurance types. Existing rows keep their name; only missing ones are added.
  const insuranceTypes = [
    { code: 'HM', name: 'Hull & Machinery' },
    { code: 'CARGO', name: 'Cargo' },
    { code: 'PNI', name: 'Protection & Indemnity' },
  ];
  for (const type of insuranceTypes) {
    await prisma.insuranceType.upsert({
      where: { code: type.code },
      update: {},
      create: type,
    });
  }

  // Dropdown values for the P&I QSheet. The user still chooses the value.
  const qsOptions = [
    { group: 'SECURITY', value: 'MSIG', sortOrder: 1 },
    { group: 'SECURITY', value: 'HYDOR', sortOrder: 2 },
    { group: 'SECURITY', value: 'IOM', sortOrder: 3 },
  ];
  for (const option of qsOptions) {
    const existing = await prisma.qsOption.findFirst({
      where: { group: option.group, value: option.value, deletedAt: null },
      select: { id: true },
    });
    if (!existing) await prisma.qsOption.create({ data: option });
  }

  const users = [
    {
      fullname: 'Super Admin',
      email: 'admin@ppmi.com',
      role: 'SUPERADMIN' as const,
      organizationUnitId: null,
    },
    {
      fullname: 'User Teknik',
      email: 'user@ppmi.com',
      role: 'USER' as const,
      organizationUnitId: cargo.id,
    },
    {
      fullname: 'P&I User 1',
      email: 'pi.user1@ppmi.com',
      role: 'USER' as const,
      organizationUnitId: pi.id,
    },
    {
      fullname: 'H&M User 1',
      email: 'hm.user1@ppmi.com',
      role: 'USER' as const,
      organizationUnitId: hm.id,
    },
    {
      fullname: 'Supervisor Teknik',
      email: 'supervisor.teknik@ppmi.com',
      role: 'USER' as const,
      organizationUnitId: supervisorTeknik.id,
    },
    {
      fullname: 'Finance User 1',
      email: 'finance.user1@ppmi.com',
      role: 'USER' as const,
      organizationUnitId: financeDepartment.id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullname: user.fullname,
        password,
        role: user.role,
        organizationUnitId: user.organizationUnitId,
        deletedAt: null,
      },
      create: {
        fullname: user.fullname,
        email: user.email,
        password,
        role: user.role,
        organizationUnitId: user.organizationUnitId,
      },
    });
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
