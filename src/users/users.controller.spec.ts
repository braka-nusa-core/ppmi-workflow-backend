import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../common/guards/auth.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  const usersServiceMock = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockReq = (overrides = {}) =>
    ({
      credentials: { sub: 'admin-1', role: 'SUPERADMIN', fullname: 'Admin' },
      ...overrides,
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('calls service.list with optional org unit filter', async () => {
      const expected = [{ id: '1', fullname: 'User 1' }];
      usersServiceMock.list.mockResolvedValue(expected);

      const result = await controller.list('unit-1');

      expect(usersServiceMock.list).toHaveBeenCalledWith('unit-1');
      expect(result).toEqual(expected);
    });

    it('calls service.list without filter when no query param', async () => {
      usersServiceMock.list.mockResolvedValue([]);

      await controller.list(undefined);

      expect(usersServiceMock.list).toHaveBeenCalledWith(undefined);
    });
  });

  describe('get', () => {
    it('calls service.get with the id', async () => {
      const expected = { id: 'user-1', fullname: 'User 1' };
      usersServiceMock.get.mockResolvedValue(expected);

      const result = await controller.get('user-1');

      expect(usersServiceMock.get).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('calls service.create with body and credentials', async () => {
      const body = {
        fullname: 'New User',
        email: 'new@test.com',
        password: 'password123',
        role: 'USER' as const,
      };
      const req = mockReq();
      const expected = { id: 'user-2', fullname: 'New User' };
      usersServiceMock.create.mockResolvedValue(expected);

      const result = await controller.create(body, req);

      expect(usersServiceMock.create).toHaveBeenCalledWith(body, {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('calls service.update with id, body, and credentials', async () => {
      const body = { fullname: 'Updated Name' };
      const req = mockReq();
      const expected = { id: 'user-1', fullname: 'Updated Name' };
      usersServiceMock.update.mockResolvedValue(expected);

      const result = await controller.update('user-1', body, req);

      expect(usersServiceMock.update).toHaveBeenCalledWith('user-1', body, {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('delete', () => {
    it('calls service.delete with id and credentials', async () => {
      const req = mockReq();
      const expected = { id: 'user-1' };
      usersServiceMock.delete.mockResolvedValue(expected);

      const result = await controller.delete('user-1', req);

      expect(usersServiceMock.delete).toHaveBeenCalledWith('user-1', {
        id: 'admin-1',
        fullname: 'Admin',
      });
      expect(result).toEqual(expected);
    });
  });
});
