import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { InsuranceTypesService } from './insurance-types.service';

describe('InsuranceTypesService', () => {
  let service: InsuranceTypesService;
  const prismaMock = {
    insuranceType: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };

  const actor = { id: 'user-1', fullname: 'User Test' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceTypesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<InsuranceTypesService>(InsuranceTypesService);
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns insurance types excluding soft-deleted ones', async () => {
      const expected = [
        { id: 'type-1', code: 'HM', name: 'Hull & Machinery' },
      ];
      prismaMock.insuranceType.findMany.mockResolvedValue(expected);

      const result = await service.list();

      expect(prismaMock.insuranceType.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('get', () => {
    it('returns an insurance type by id', async () => {
      const expected = { id: 'type-1', code: 'HM', name: 'Hull & Machinery' };
      prismaMock.insuranceType.findFirst.mockResolvedValue(expected);

      const result = await service.get('type-1');

      expect(prismaMock.insuranceType.findFirst).toHaveBeenCalledWith({
        where: { id: 'type-1', deletedAt: null },
      });
      expect(result).toEqual(expected);
    });

    it('throws NotFoundException when type is not found', async () => {
      prismaMock.insuranceType.findFirst.mockResolvedValue(null);

      await expect(service.get('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates an insurance type and audit log', async () => {
      const dto = { code: 'HM', name: 'Hull & Machinery' };
      const created = { id: 'type-1', code: 'HM', name: 'Hull & Machinery', description: null };

      prismaMock.$transaction.mockImplementation(async (cb: Function) => {
        return cb(prismaMock);
      });
      prismaMock.insuranceType.create.mockResolvedValue(created);

      const result = await service.create(dto, actor);

      expect(prismaMock.insuranceType.create).toHaveBeenCalledWith({
        data: {
          code: 'HM',
          name: 'Hull & Machinery',
          description: undefined,
        },
      });
      expect(prismaMock.log.create).toHaveBeenCalledWith({
        data: {
          action: 'CREATE',
          referenceId: 'type-1',
          referenceType: 'INSURANCE_TYPE',
          userId: 'user-1',
          description: 'User Test created insurance type Hull & Machinery (HM)',
        },
      });
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('updates an insurance type and creates audit log', async () => {
      const existing = { id: 'type-1', code: 'HM', name: 'Hull & Machinery' };
      const dto = { name: 'Hull & Machinery Updated' };
      const updated = { ...existing, name: 'Hull & Machinery Updated' };

      prismaMock.insuranceType.findFirst.mockResolvedValue(existing);
      prismaMock.$transaction.mockImplementation(async (cb: Function) => {
        return cb(prismaMock);
      });
      prismaMock.insuranceType.update.mockResolvedValue(updated);

      const result = await service.update('type-1', dto, actor);

      expect(prismaMock.insuranceType.update).toHaveBeenCalledWith({
        where: { id: 'type-1' },
        data: { name: 'Hull & Machinery Updated' },
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when type does not exist', async () => {
      prismaMock.insuranceType.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'X' }, actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('soft deletes an insurance type and creates audit log', async () => {
      const existing = {
        id: 'type-1',
        name: 'Hull & Machinery',
        code: 'HM',
      };

      prismaMock.insuranceType.findFirst.mockResolvedValue(existing);
      prismaMock.$transaction.mockImplementation(async (cb: Function) => {
        return cb(prismaMock);
      });

      const result = await service.delete('type-1', actor);

      expect(prismaMock.insuranceType.update).toHaveBeenCalledWith({
        where: { id: 'type-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'type-1' });
    });

    it('throws NotFoundException when type does not exist', async () => {
      prismaMock.insuranceType.findFirst.mockResolvedValue(null);

      await expect(service.delete('nonexistent', actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
