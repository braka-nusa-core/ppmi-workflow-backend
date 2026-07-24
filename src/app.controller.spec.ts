import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './common/guards/auth.guard';

describe('AppController', () => {
  let controller: AppController;
  const appServiceMock = {
    login: vi.fn(),
    profile: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appServiceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AppController>(AppController);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('index', () => {
    it('returns undefined (ResponseInterceptor wraps the response)', () => {
      const result = controller.index();
      expect(result).toBeUndefined();
    });
  });

  describe('login', () => {
    it('delegates to appService.login and returns the result', async () => {
      const loginBody = { email: 'test@test.com', password: 'password123' };
      const expected = {
        id: 'user-1',
        fullname: 'Test',
        email: 'test@test.com',
        organization_unit: null,
        access_token: 'token',
      };
      appServiceMock.login.mockResolvedValue(expected);

      const result = await controller.login(loginBody);

      expect(appServiceMock.login).toHaveBeenCalledWith(loginBody);
      expect(result).toEqual(expected);
    });
  });

  describe('profile', () => {
    it('delegates to appService.profile with req.credentials.sub', async () => {
      const mockReq = {
        credentials: {
          sub: 'user-1',
          role: 'SUPERADMIN' as const,
          fullname: 'Admin',
        },
      };
      const expected = {
        id: 'user-1',
        fullname: 'Admin',
        email: 'admin@test.com',
        phone: null,
        role: 'SUPERADMIN',
        organization_unit: null,
        permissions: null,
      };
      appServiceMock.profile.mockResolvedValue(expected);

      const result = await controller.profile(mockReq as any);

      expect(appServiceMock.profile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });
});
