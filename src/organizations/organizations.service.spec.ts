import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { OrganizationsService } from './organizations.service';

const mockTx = {
  organizationUnit: {
    create: vi.fn(),
    update: vi.fn(),
  },
  permission: {
    create: vi.fn(),
    update: vi.fn(),
  },
  log: {
    create: vi.fn(),
  },
};

const prismaMock = {
  organizationUnit: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  permission: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  organizationUnitPermission: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    count: vi.fn(),
  },
  log: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    vi.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx),
    );
  });

  describe('list', () => {
    it('returns tree structure of divisions with children', async () => {
      const divisions = [
        {
          id: 'div-1',
          name: 'Teknik',
          type: 'DIVISION',
          children: [
            { id: 'dept-1', name: 'H&M', type: 'DEPARTMENT', _count: { users: 5 } },
          ],
        },
      ];
      prismaMock.organizationUnit.findMany.mockResolvedValue(divisions);

      const result = await service.list();

      expect(prismaMock.organizationUnit.findMany).toHaveBeenCalledWith({
        where: { parentId: null, deletedAt: null },
        include: {
          children: {
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
            include: { _count: { select: { users: true } } },
          },
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(divisions);
    });
  });

  describe('get', () => {
    it('returns organization when found', async () => {
      const org = { id: 'org-1', name: 'Teknik', type: 'DIVISION' };
      prismaMock.organizationUnit.findFirst.mockResolvedValue(org);

      const result = await service.get('org-1');

      expect(result).toEqual(org);
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue(null);

      await expect(service.get('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const actor = { id: 'admin-1', fullname: 'Admin' };

    it('creates a DIVISION', async () => {
      const dto = { name: 'New Division', type: 'DIVISION' as const };
      const created = { id: 'div-1', name: 'New Division', type: 'DIVISION', parentId: null };
      mockTx.organizationUnit.create.mockResolvedValue(created);

      const result = await service.create(dto, actor);

      expect(mockTx.organizationUnit.create).toHaveBeenCalledWith({
        data: { name: 'New Division', type: 'DIVISION', parentId: null },
        select: expect.any(Object),
      });
      expect(mockTx.log.create).toHaveBeenCalledWith({
        data: {
          action: 'CREATE',
          referenceId: 'div-1',
          referenceType: 'USER_MANAGEMENT',
          userId: 'admin-1',
          description: 'Admin created organization New Division (DIVISION)',
        },
      });
      expect(result).toEqual(created);
    });

    it('creates a DEPARTMENT with valid parent', async () => {
      const dto = { name: 'New Dept', type: 'DEPARTMENT' as const, parentId: 'div-1' };
      prismaMock.organizationUnit.findFirst.mockResolvedValue({ id: 'div-1', type: 'DIVISION' });
      const created = { id: 'dept-1', name: 'New Dept', type: 'DEPARTMENT', parentId: 'div-1' };
      mockTx.organizationUnit.create.mockResolvedValue(created);

      const result = await service.create(dto, actor);

      expect(result).toEqual(created);
    });

    it('throws when DEPARTMENT has no parentId', async () => {
      const dto = { name: 'Orphan Dept', type: 'DEPARTMENT' as const };

      await expect(service.create(dto, actor)).rejects.toThrow(BadRequestException);
    });

    it('throws when parent DIVISION does not exist', async () => {
      const dto = { name: 'Orphan Dept', type: 'DEPARTMENT' as const, parentId: 'nonexistent' };
      prismaMock.organizationUnit.findFirst.mockResolvedValue(null);

      await expect(service.create(dto, actor)).rejects.toThrow(BadRequestException);
    });

    it('throws when DIVISION has parentId', async () => {
      const dto = { name: 'Bad Div', type: 'DIVISION' as const, parentId: 'some-parent' };

      await expect(service.create(dto, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    const actor = { id: 'admin-1', fullname: 'Admin' };

    it('updates an organization', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue({
        id: 'org-1',
        name: 'Old Name',
        type: 'DIVISION',
        parentId: null,
      });
      const updated = { id: 'org-1', name: 'New Name', type: 'DIVISION', parentId: null };
      mockTx.organizationUnit.update.mockResolvedValue(updated);

      const result = await service.update('org-1', { name: 'New Name' }, actor);

      expect(mockTx.organizationUnit.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { name: 'New Name' },
        select: expect.any(Object),
      });
      expect(mockTx.log.create).toHaveBeenCalledWith({
        data: {
          action: 'UPDATE',
          referenceId: 'org-1',
          referenceType: 'USER_MANAGEMENT',
          userId: 'admin-1',
          description: 'Admin updated organization New Name',
        },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' }, actor)).rejects.toThrow(NotFoundException);
    });

    it('throws when DEPARTMENT lacks parentId', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue({
        id: 'dept-1',
        name: 'Dept',
        type: 'DEPARTMENT',
        parentId: null,
        children: [],
      });

      await expect(
        service.update('dept-1', { type: 'DEPARTMENT' }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when parent DIVISION not found', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValueOnce({
        id: 'dept-1',
        name: 'Dept',
        type: 'DEPARTMENT',
        parentId: 'old-parent',
        children: [],
      });
      prismaMock.organizationUnit.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update('dept-1', { parentId: 'nonexistent' }, actor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    const actor = { id: 'admin-1', fullname: 'Admin' };

    it('soft-deletes an organization', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue({
        id: 'org-1',
        name: 'Teknik',
      });
      prismaMock.organizationUnit.count.mockResolvedValue(0);
      prismaMock.user.count.mockResolvedValue(0);

      const result = await service.delete('org-1', actor);

      expect(mockTx.organizationUnit.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockTx.log.create).toHaveBeenCalledWith({
        data: {
          action: 'DELETE',
          referenceId: 'org-1',
          referenceType: 'USER_MANAGEMENT',
          userId: 'admin-1',
          description: 'Admin deleted organization Teknik',
        },
      });
      expect(result).toEqual({ id: 'org-1' });
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue(null);

      await expect(service.delete('nonexistent', actor)).rejects.toThrow(NotFoundException);
    });

    it('throws when organization has active children', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue({ id: 'div-1', name: 'Div' });
      prismaMock.organizationUnit.count.mockResolvedValue(2);

      await expect(service.delete('div-1', actor)).rejects.toThrow(BadRequestException);
    });

    it('throws when organization has active users', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue({ id: 'div-1', name: 'Div' });
      prismaMock.organizationUnit.count.mockResolvedValue(0);
      prismaMock.user.count.mockResolvedValue(3);

      await expect(service.delete('div-1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPermissions', () => {
    it('returns all permissions', async () => {
      const permissions = [
        { id: 'perm-1', resource: 'org', action: 'create' },
        { id: 'perm-2', resource: 'org', action: 'read' },
      ];
      prismaMock.permission.findMany.mockResolvedValue(permissions);

      const result = await service.getPermissions();

      expect(prismaMock.permission.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      });
      expect(result).toEqual(permissions);
    });
  });

  describe('getPermission', () => {
    it('returns permission when found', async () => {
      const perm = { id: 'perm-1', resource: 'org', action: 'create' };
      prismaMock.permission.findFirst.mockResolvedValue(perm);

      const result = await service.getPermission('perm-1');

      expect(prismaMock.permission.findFirst).toHaveBeenCalledWith({ where: { id: 'perm-1', deletedAt: null } });
      expect(result).toEqual(perm);
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.permission.findFirst.mockResolvedValue(null);

      await expect(service.getPermission('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPermission', () => {
    const actor = { id: 'admin-1', fullname: 'Admin' };

    it('creates a permission', async () => {
      const dto = { resource: 'org', action: 'create' };
      const created = { id: 'perm-1', resource: 'org', action: 'create' };
      mockTx.permission.create.mockResolvedValue(created);

      const result = await service.createPermission(dto, actor);

      expect(mockTx.permission.create).toHaveBeenCalledWith({
        data: { resource: 'org', action: 'create', description: null },
        select: { id: true, resource: true, action: true, description: true },
      });
      expect(mockTx.log.create).toHaveBeenCalledWith({
        data: {
          action: 'CREATE',
          referenceId: 'perm-1',
          referenceType: 'USER_MANAGEMENT',
          userId: 'admin-1',
          description: 'Admin created permission org:create',
        },
      });
      expect(result).toEqual(created);
    });
  });

  describe('updatePermission', () => {
    const actor = { id: 'admin-1', fullname: 'Admin' };

    it('updates a permission', async () => {
      prismaMock.permission.findFirst.mockResolvedValue({ id: 'perm-1', resource: 'org', action: 'create' });
      const updated = { id: 'perm-1', resource: 'org', action: 'create', description: 'Updated desc' };
      mockTx.permission.update.mockResolvedValue(updated);

      const result = await service.updatePermission('perm-1', { description: 'Updated desc' }, actor);

      expect(mockTx.permission.update).toHaveBeenCalledWith({
        where: { id: 'perm-1' },
        data: { description: 'Updated desc' },
        select: { id: true, resource: true, action: true, description: true },
      });
      expect(mockTx.log.create).toHaveBeenCalledWith({
        data: {
          action: 'UPDATE',
          referenceId: 'perm-1',
          referenceType: 'USER_MANAGEMENT',
          userId: 'admin-1',
          description: 'Admin updated permission org:create',
        },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.permission.findFirst.mockResolvedValue(null);

      await expect(service.updatePermission('nonexistent', { description: 'desc' }, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePermission', () => {
    const actor = { id: 'admin-1', fullname: 'Admin' };

    it('deletes a permission', async () => {
      prismaMock.permission.findFirst.mockResolvedValue({ id: 'perm-1', resource: 'org', action: 'create' });
      prismaMock.organizationUnitPermission.findMany.mockResolvedValue([]);

      const result = await service.deletePermission('perm-1', actor);

      expect(mockTx.permission.update).toHaveBeenCalledWith({
        where: { id: 'perm-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockTx.log.create).toHaveBeenCalledWith({
        data: {
          action: 'DELETE',
          referenceId: 'perm-1',
          referenceType: 'USER_MANAGEMENT',
          userId: 'admin-1',
          description: 'Admin deleted permission org:create',
        },
      });
      expect(result).toEqual({ id: 'perm-1' });
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.permission.findFirst.mockResolvedValue(null);

      await expect(service.deletePermission('nonexistent', actor)).rejects.toThrow(NotFoundException);
    });

    it('throws when permission is assigned to organizations', async () => {
      prismaMock.permission.findFirst.mockResolvedValue({ id: 'perm-1', resource: 'org', action: 'create' });
      prismaMock.organizationUnitPermission.findMany.mockResolvedValue([{ organizationUnitId: 'org-1' }]);

      await expect(service.deletePermission('perm-1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOrgPermissions', () => {
    it('returns flattened permissions for an org', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue({ id: 'org-1', name: 'Teknik' });
      const assignments = [
        {
          permission: { id: 'perm-1', resource: 'org', action: 'create' },
        },
        {
          permission: { id: 'perm-2', resource: 'org', action: 'read' },
        },
      ];
      prismaMock.organizationUnitPermission.findMany.mockResolvedValue(assignments);

      const result = await service.getOrgPermissions('org-1');

      expect(prismaMock.organizationUnitPermission.findMany).toHaveBeenCalledWith({
        where: { organizationUnitId: 'org-1' },
        select: {
          permission: {
            select: { id: true, resource: true, action: true },
          },
        },
      });
      expect(result).toEqual([
        { id: 'perm-1', resource: 'org', action: 'create' },
        { id: 'perm-2', resource: 'org', action: 'read' },
      ]);
    });
  });

  describe('assignPermissions', () => {
    it('assigns permissions to an org', async () => {
      const dto = { permissionIds: ['perm-1', 'perm-2'] };
      prismaMock.organizationUnit.findFirst.mockResolvedValue({ id: 'org-1', name: 'Teknik' });
      prismaMock.organizationUnitPermission.findMany.mockResolvedValue([]);

      const result = await service.assignPermissions('org-1', dto, { id: 'admin-1', fullname: 'Admin' });

      expect(prismaMock.organizationUnitPermission.createMany).toHaveBeenCalledWith({
        data: [
          { organizationUnitId: 'org-1', permissionId: 'perm-1' },
          { organizationUnitId: 'org-1', permissionId: 'perm-2' },
        ],
        skipDuplicates: true,
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
      expect(result).toEqual({ assigned: 2 });
    });
  });

  describe('removePermission', () => {
    it('removes a permission assignment', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue({ id: 'org-1', name: 'Teknik' });
      prismaMock.organizationUnitPermission.findUnique.mockResolvedValue({
        organizationUnitId: 'org-1',
        permissionId: 'perm-1',
      });

      const result = await service.removePermission('org-1', 'perm-1', { id: 'admin-1', fullname: 'Admin' });

      expect(prismaMock.organizationUnitPermission.delete).toHaveBeenCalledWith({
        where: {
          organizationUnitId_permissionId: { organizationUnitId: 'org-1', permissionId: 'perm-1' },
        },
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'perm-1' });
    });

    it('throws NotFoundException when assignment not found', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue({ id: 'org-1', name: 'Teknik' });
      prismaMock.organizationUnitPermission.findUnique.mockResolvedValue(null);

      await expect(service.removePermission('org-1', 'nonexistent', { id: 'admin-1', fullname: 'Admin' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when org not found', async () => {
      prismaMock.organizationUnit.findFirst.mockResolvedValue(null);

      await expect(service.removePermission('org-1', 'perm-1', { id: 'admin-1', fullname: 'Admin' })).rejects.toThrow(NotFoundException);
    });
  });
});
