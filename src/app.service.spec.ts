import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppService } from './app.service';
import { PrismaService } from './common/services/prisma.service';
import * as bcryptUtil from './utils/bcrypt.util';

vi.spyOn(bcryptUtil, 'verifyPassword');

describe('AppService', () => {
  let service: AppService;
  const jwtMock = { signAsync: vi.fn() };
  const prismaMock = {
    user: { findUnique: vi.fn() },
    log: { create: vi.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    vi.clearAllMocks();
  });

  describe('login', () => {
    const loginBody = { email: 'user@test.com', password: 'password123' };
    const mockUser = {
      id: 'user-1',
      fullname: 'User Test',
      email: 'user@test.com',
      password: 'hashed-password',
      role: 'USER' as const,
      organization_unit: { name: 'Teknik' },
    };

    it('returns user data and token when credentials are valid', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcryptUtil.verifyPassword).mockResolvedValue(true);
      jwtMock.signAsync.mockResolvedValue('mock-jwt-token');

      const result = await service.login(loginBody);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginBody.email },
        select: {
          id: true,
          fullname: true,
          email: true,
          password: true,
          role: true,
          organization_unit: { select: { name: true } },
        },
      });
      expect(bcryptUtil.verifyPassword).toHaveBeenCalledWith(
        loginBody.password,
        mockUser.password,
      );
      expect(jwtMock.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        role: mockUser.role,
        fullname: mockUser.fullname,
      });
      expect(prismaMock.log.create).toHaveBeenCalledWith({
        data: {
          action: 'LOGIN',
          reference_id: mockUser.id,
          reference_type: 'USER_MANAGEMENT',
          user_id: mockUser.id,
          description: `${mockUser.fullname} logged in`,
        },
      });
      expect(result).toEqual({
        id: mockUser.id,
        fullname: mockUser.fullname,
        email: mockUser.email,
        organization_unit: 'Teknik',
        access_token: 'mock-jwt-token',
      });
    });

    it('throws UnauthorizedException when user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginBody)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(bcryptUtil.verifyPassword).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcryptUtil.verifyPassword).mockResolvedValue(false);

      await expect(service.login(loginBody)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('profile', () => {
    const userId = 'user-1';

    it('returns profile data for SUPERADMIN with null permissions', async () => {
      const superAdmin = {
        id: userId,
        fullname: 'Super Admin',
        email: 'admin@test.com',
        phone: null,
        role: 'SUPERADMIN' as const,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-01'),
        organization_unit: null,
      };
      prismaMock.user.findUnique.mockResolvedValue(superAdmin);

      const result = await service.profile(userId);

      expect(result).toEqual({
        id: userId,
        fullname: 'Super Admin',
        email: 'admin@test.com',
        phone: null,
        role: 'SUPERADMIN',
        created_at: superAdmin.created_at,
        updated_at: superAdmin.updated_at,
        organization_unit: null,
        permissions: null,
      });
    });

    it('returns profile for USER with permissions array', async () => {
      const regularUser = {
        id: userId,
        fullname: 'User Teknik',
        email: 'user@test.com',
        phone: '08123456789',
        role: 'USER' as const,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-01'),
        organization_unit: {
          id: 'unit-1',
          name: 'Teknik',
          type: 'DIVISION' as const,
          permissions: [
            {
              permission: { resource: 'bank', action: 'read' },
            },
            {
              permission: { resource: 'bank', action: 'create' },
            },
          ],
          parent: null,
        },
      };
      prismaMock.user.findUnique.mockResolvedValue(regularUser);

      const result = await service.profile(userId);

      expect(result).toEqual({
        id: userId,
        fullname: 'User Teknik',
        email: 'user@test.com',
        phone: '08123456789',
        role: 'USER',
        created_at: regularUser.created_at,
        updated_at: regularUser.updated_at,
        organization_unit: {
          name: 'Teknik',
          type: 'DIVISION',
          parent: null,
        },
        permissions: ['bank:read', 'bank:create'],
      });
    });

    it('returns empty permissions array when user has no org unit', async () => {
      const userNoOrg = {
        id: userId,
        fullname: 'User No Org',
        email: 'noorg@test.com',
        phone: null,
        role: 'USER' as const,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-01'),
        organization_unit: null,
      };
      prismaMock.user.findUnique.mockResolvedValue(userNoOrg);

      const result = await service.profile(userId);

      expect(result.permissions).toEqual([]);
      expect(result.organization_unit).toBeNull();
    });

    it('throws UnauthorizedException when user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.profile(userId)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
