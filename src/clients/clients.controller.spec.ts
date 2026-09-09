import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PrismaService } from '../common/services/prisma.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

describe('ClientsController', () => {
  let controller: ClientsController;
  const clientsServiceMock = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [
        { provide: ClientsService, useValue: clientsServiceMock },
        { provide: PrismaService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ClientsController>(ClientsController);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('delegates to clientsService.list', async () => {
      const expected = [{ id: 'client-1', name: 'PT ABC' }];
      clientsServiceMock.list.mockResolvedValue(expected);

      const result = await controller.list();

      expect(clientsServiceMock.list).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('get', () => {
    it('delegates to clientsService.get with id', async () => {
      const expected = { id: 'client-1', name: 'PT ABC' };
      clientsServiceMock.get.mockResolvedValue(expected);

      const result = await controller.get('client-1');

      expect(clientsServiceMock.get).toHaveBeenCalledWith('client-1');
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('delegates to clientsService.create with dto and actor', async () => {
      const dto = { name: 'PT ABC' };
      const mockReq = {
        credentials: {
          sub: 'user-1',
          fullname: 'User Test',
          role: 'USER' as const,
        },
      };
      const expected = { id: 'client-1', name: 'PT ABC' };
      clientsServiceMock.create.mockResolvedValue(expected);

      const result = await controller.create(dto, mockReq as any);

      expect(clientsServiceMock.create).toHaveBeenCalledWith(dto, {
        id: 'user-1',
        fullname: 'User Test',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('delegates to clientsService.update with id, dto, and actor', async () => {
      const dto = { name: 'PT ABC Updated' };
      const mockReq = {
        credentials: {
          sub: 'user-1',
          fullname: 'User Test',
          role: 'USER' as const,
        },
      };
      const expected = { id: 'client-1', name: 'PT ABC Updated' };
      clientsServiceMock.update.mockResolvedValue(expected);

      const result = await controller.update('client-1', dto, mockReq as any);

      expect(clientsServiceMock.update).toHaveBeenCalledWith('client-1', dto, {
        id: 'user-1',
        fullname: 'User Test',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('delete', () => {
    it('delegates to clientsService.delete with id and actor', async () => {
      const mockReq = {
        credentials: {
          sub: 'user-1',
          fullname: 'User Test',
          role: 'USER' as const,
        },
      };
      clientsServiceMock.delete.mockResolvedValue({ id: 'client-1' });

      const result = await controller.delete('client-1', mockReq as any);

      expect(clientsServiceMock.delete).toHaveBeenCalledWith('client-1', {
        id: 'user-1',
        fullname: 'User Test',
      });
      expect(result).toEqual({ id: 'client-1' });
    });
  });
});
