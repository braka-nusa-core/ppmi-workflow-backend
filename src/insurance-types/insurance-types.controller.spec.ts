import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PrismaService } from '../common/services/prisma.service';
import { InsuranceTypesController } from './insurance-types.controller';
import { InsuranceTypesService } from './insurance-types.service';

describe('InsuranceTypesController', () => {
  let controller: InsuranceTypesController;
  const insuranceTypesServiceMock = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InsuranceTypesController],
      providers: [
        { provide: InsuranceTypesService, useValue: insuranceTypesServiceMock },
        { provide: PrismaService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<InsuranceTypesController>(InsuranceTypesController);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('delegates to insuranceTypesService.list', async () => {
      const expected = [{ id: 'type-1', code: 'HM', name: 'Hull & Machinery' }];
      insuranceTypesServiceMock.list.mockResolvedValue(expected);

      const result = await controller.list();

      expect(insuranceTypesServiceMock.list).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('get', () => {
    it('delegates to insuranceTypesService.get with id', async () => {
      const expected = { id: 'type-1', code: 'HM', name: 'Hull & Machinery' };
      insuranceTypesServiceMock.get.mockResolvedValue(expected);

      const result = await controller.get('type-1');

      expect(insuranceTypesServiceMock.get).toHaveBeenCalledWith('type-1');
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('delegates to insuranceTypesService.create with dto and actor', async () => {
      const dto = { code: 'HM', name: 'Hull & Machinery' };
      const mockReq = {
        credentials: { sub: 'user-1', fullname: 'User Test', role: 'USER' as const },
      };
      const expected = { id: 'type-1', code: 'HM', name: 'Hull & Machinery' };
      insuranceTypesServiceMock.create.mockResolvedValue(expected);

      const result = await controller.create(dto, mockReq as any);

      expect(insuranceTypesServiceMock.create).toHaveBeenCalledWith(dto, {
        id: 'user-1',
        fullname: 'User Test',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('delegates to insuranceTypesService.update with id, dto, and actor', async () => {
      const dto = { name: 'Hull & Machinery Updated' };
      const mockReq = {
        credentials: { sub: 'user-1', fullname: 'User Test', role: 'USER' as const },
      };
      const expected = { id: 'type-1', code: 'HM', name: 'Hull & Machinery Updated' };
      insuranceTypesServiceMock.update.mockResolvedValue(expected);

      const result = await controller.update('type-1', dto, mockReq as any);

      expect(insuranceTypesServiceMock.update).toHaveBeenCalledWith(
        'type-1',
        dto,
        { id: 'user-1', fullname: 'User Test' },
      );
      expect(result).toEqual(expected);
    });
  });

  describe('delete', () => {
    it('delegates to insuranceTypesService.delete with id and actor', async () => {
      const mockReq = {
        credentials: { sub: 'user-1', fullname: 'User Test', role: 'USER' as const },
      };
      insuranceTypesServiceMock.delete.mockResolvedValue({ id: 'type-1' });

      const result = await controller.delete('type-1', mockReq as any);

      expect(insuranceTypesServiceMock.delete).toHaveBeenCalledWith('type-1', {
        id: 'user-1',
        fullname: 'User Test',
      });
      expect(result).toEqual({ id: 'type-1' });
    });
  });
});
