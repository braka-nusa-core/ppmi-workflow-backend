import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import * as bcryptUtil from '../utils/bcrypt.util';
import { UsersService } from './users.service';

vi.spyOn(bcryptUtil, 'hashPassword');

const mockTx = {
  user: {
    create: vi.fn(),
    update: vi.fn(),
  },
  log: {
    create: vi.fn(),
  },
};

const prismaMock = {
  user: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    vi.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx),
    );
  });

  describe('list', () => {
    it('returns all non-deleted users', async () => {
      const users = [{ id: '1', fullname: 'User 1' }];
      prismaMock.user.findMany.mockResolvedValue(users);

      const result = await service.list();

      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null, role: { not: 'SUPERADMIN' } },
        select: expect.any(Object),
        orderBy: { created_at: 'desc' },
      });
      expect(result).toEqual(users);
    });

    it('filters by organization_unit_id', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.list('unit-1');

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deleted_at: null,
            organization_unit_id: 'unit-1',
            role: { not: 'SUPERADMIN' },
          },
        }),
      );
    });
  });

  describe('get', () => {
    it('returns a user when found', async () => {
      const user = { id: '1', fullname: 'User 1' };
      prismaMock.user.findFirst.mockResolvedValue(user);

      const result = await service.get('1');

      expect(result).toEqual(user);
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.get('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      fullname: 'New User',
      email: 'new@test.com',
      password: 'password123',
      role: 'USER' as const,
    };
    const actor = { id: 'admin-1', fullname: 'Admin' };

    it('creates a user and logs the action', async () => {
      vi.mocked(bcryptUtil.hashPassword).mockResolvedValue('hashed-password');
      const created = {
        id: 'user-1',
        fullname: 'New User',
        email: 'new@test.com',
      };
      mockTx.user.create.mockResolvedValue(created);

      const result = await service.create(dto, actor);

      expect(bcryptUtil.hashPassword).toHaveBeenCalledWith('password123');
      expect(mockTx.user.create).toHaveBeenCalledWith({
        data: {
          fullname: 'New User',
          email: 'new@test.com',
          password: 'hashed-password',
          phone: undefined,
          role: 'USER',
          organization_unit_id: undefined,
        },
        select: expect.any(Object),
      });
      expect(mockTx.log.create).toHaveBeenCalledWith({
        data: {
          action: 'CREATE',
          reference_id: 'user-1',
          reference_type: 'USER_MANAGEMENT',
          user_id: 'admin-1',
          description: 'Admin created user New User (new@test.com)',
        },
      });
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    const actor = { id: 'admin-1', fullname: 'Admin' };

    it('updates a user and logs the action', async () => {
      const existing = {
        id: 'user-1',
        fullname: 'Old Name',
        email: 'old@test.com',
        password: 'old-hash',
      };
      prismaMock.user.findFirst.mockResolvedValue(existing);
      vi.mocked(bcryptUtil.hashPassword).mockResolvedValue('new-hash');

      const updated = {
        id: 'user-1',
        fullname: 'New Name',
        email: 'old@test.com',
      };
      mockTx.user.update.mockResolvedValue(updated);

      const result = await service.update(
        'user-1',
        { fullname: 'New Name' },
        actor,
      );

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { fullname: 'New Name' },
        select: expect.any(Object),
      });
      expect(mockTx.log.create).toHaveBeenCalledWith({
        data: {
          action: 'UPDATE',
          reference_id: 'user-1',
          reference_type: 'USER_MANAGEMENT',
          user_id: 'admin-1',
          description: 'Admin updated user New Name',
        },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when user not found', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { fullname: 'X' }, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when email is taken', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce({
        id: 'user-1',
        email: 'current@test.com',
      });
      prismaMock.user.findFirst.mockResolvedValueOnce({
        id: 'other-user',
        email: 'taken@test.com',
      });

      await expect(
        service.update('user-1', { email: 'taken@test.com' }, actor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    const actor = { id: 'admin-1', fullname: 'Admin' };

    it('soft-deletes a user and logs the action', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'user-1',
        fullname: 'User To Delete',
        email: 'delete@test.com',
      });

      const result = await service.delete('user-1', actor);

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { deleted_at: expect.any(Date) },
      });
      expect(mockTx.log.create).toHaveBeenCalledWith({
        data: {
          action: 'DELETE',
          reference_id: 'user-1',
          reference_type: 'USER_MANAGEMENT',
          user_id: 'admin-1',
          description: 'Admin deleted user User To Delete (delete@test.com)',
        },
      });
      expect(result).toEqual({ id: 'user-1' });
    });

    it('throws NotFoundException when user not found', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.delete('nonexistent', actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
