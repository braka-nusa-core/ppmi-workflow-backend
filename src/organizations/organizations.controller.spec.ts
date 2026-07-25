import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../common/guards/auth.guard';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  const organizationsServiceMock = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getPermissions: vi.fn(),
    getPermission: vi.fn(),
    createPermission: vi.fn(),
    updatePermission: vi.fn(),
    deletePermission: vi.fn(),
    getOrgPermissions: vi.fn(),
    assignPermissions: vi.fn(),
    removePermission: vi.fn(),
  };

  const mockReq = (overrides = {}) =>
    ({
      credentials: { sub: 'admin-1', role: 'SUPERADMIN', fullname: 'Admin' },
      ...overrides,
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [{ provide: OrganizationsService, useValue: organizationsServiceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('calls service.list', async () => {
      const expected = [{ id: 'div-1', name: 'Teknik' }];
      organizationsServiceMock.list.mockResolvedValue(expected);

      const result = await controller.list();

      expect(organizationsServiceMock.list).toHaveBeenCalledWith();
      expect(result).toEqual(expected);
    });
  });

  describe('get', () => {
    it('calls service.get with the id', async () => {
      const expected = { id: 'div-1', name: 'Teknik' };
      organizationsServiceMock.get.mockResolvedValue(expected);

      const result = await controller.get('div-1');

      expect(organizationsServiceMock.get).toHaveBeenCalledWith('div-1');
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('calls service.create with body and credentials', async () => {
      const body = { name: 'New Div', type: 'DIVISION' as const };
      const req = mockReq();
      const expected = { id: 'div-2', name: 'New Div' };
      organizationsServiceMock.create.mockResolvedValue(expected);

      const result = await controller.create(body, req);

      expect(organizationsServiceMock.create).toHaveBeenCalledWith(body, {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('calls service.update with id, body, and credentials', async () => {
      const body = { name: 'Updated Div' };
      const req = mockReq();
      const expected = { id: 'div-1', name: 'Updated Div' };
      organizationsServiceMock.update.mockResolvedValue(expected);

      const result = await controller.update('div-1', body, req);

      expect(organizationsServiceMock.update).toHaveBeenCalledWith('div-1', body, {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('delete', () => {
    it('calls service.delete with id and credentials', async () => {
      const req = mockReq();
      const expected = { id: 'div-1' };
      organizationsServiceMock.delete.mockResolvedValue(expected);

      const result = await controller.delete('div-1', req);

      expect(organizationsServiceMock.delete).toHaveBeenCalledWith('div-1', {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('getPermissions', () => {
    it('calls service.getPermissions', async () => {
      const expected = [{ id: 'perm-1', resource: 'org', action: 'create' }];
      organizationsServiceMock.getPermissions.mockResolvedValue(expected);

      const result = await controller.getPermissions();

      expect(organizationsServiceMock.getPermissions).toHaveBeenCalledWith();
      expect(result).toEqual(expected);
    });
  });

  describe('createPermission', () => {
    it('calls service.createPermission with body and credentials', async () => {
      const body = { resource: 'org', action: 'create' };
      const req = mockReq();
      const expected = { id: 'perm-1', resource: 'org', action: 'create' };
      organizationsServiceMock.createPermission.mockResolvedValue(expected);

      const result = await controller.createPermission(body, req);

      expect(organizationsServiceMock.createPermission).toHaveBeenCalledWith(body, {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('updatePermission', () => {
    it('calls service.updatePermission with id, body, and credentials', async () => {
      const body = { action: 'update' };
      const req = mockReq();
      const expected = { id: 'perm-1', resource: 'org', action: 'update' };
      organizationsServiceMock.updatePermission.mockResolvedValue(expected);

      const result = await controller.updatePermission('perm-1', body, req);

      expect(organizationsServiceMock.updatePermission).toHaveBeenCalledWith('perm-1', body, {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('deletePermission', () => {
    it('calls service.deletePermission with id and credentials', async () => {
      const req = mockReq();
      const expected = { id: 'perm-1' };
      organizationsServiceMock.deletePermission.mockResolvedValue(expected);

      const result = await controller.deletePermission('perm-1', req);

      expect(organizationsServiceMock.deletePermission).toHaveBeenCalledWith('perm-1', {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('getOrgPermissions', () => {
    it('calls service.getOrgPermissions with org id', async () => {
      const expected = [{ id: 'perm-1', resource: 'org', action: 'create' }];
      organizationsServiceMock.getOrgPermissions.mockResolvedValue(expected);

      const result = await controller.getOrgPermissions('org-1');

      expect(organizationsServiceMock.getOrgPermissions).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(expected);
    });
  });

  describe('assignPermissions', () => {
    it('calls service.assignPermissions with org id, body, and credentials', async () => {
      const body = { permissionIds: ['perm-1', 'perm-2'] };
      const req = mockReq();
      organizationsServiceMock.assignPermissions.mockResolvedValue({ assigned: 2 });

      const result = await controller.assignPermissions('org-1', body, req);

      expect(organizationsServiceMock.assignPermissions).toHaveBeenCalledWith('org-1', body, {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual({ assigned: 2 });
    });
  });

  describe('removePermission', () => {
    it('calls service.removePermission with org id, perm id, and credentials', async () => {
      const req = mockReq();
      organizationsServiceMock.removePermission.mockResolvedValue({ id: 'perm-1' });

      const result = await controller.removePermission('org-1', 'perm-1', req);

      expect(organizationsServiceMock.removePermission).toHaveBeenCalledWith('org-1', 'perm-1', {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual({ id: 'perm-1' });
    });
  });
});
