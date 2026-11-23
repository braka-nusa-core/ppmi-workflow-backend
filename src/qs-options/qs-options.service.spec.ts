import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QsOptionsService } from './qs-options.service';
import {
  createQsOptionSchema,
  updateQsOptionSchema,
} from './qs-options.validation';

describe('QsOptionsService', () => {
  const prismaMock = {
    qsOption: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const actor = { id: 'user-1', fullname: 'User Test' };
  let service: QsOptionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    service = new QsOptionsService(prismaMock as any);
  });

  describe('list', () => {
    it('returns only active, non-deleted options of the group in order', async () => {
      prismaMock.qsOption.findMany.mockResolvedValue([]);

      await service.list({ group: 'SECURITY' });

      expect(prismaMock.qsOption.findMany).toHaveBeenCalledWith({
        where: { group: 'SECURITY', isActive: true, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
      });
    });

    it('listAll includes inactive options and works without a group', async () => {
      prismaMock.qsOption.findMany.mockResolvedValue([]);

      await service.listAll({});
      await service.listAll({ group: 'SECURITY' });

      const [first, second] = prismaMock.qsOption.findMany.mock.calls;
      expect(first[0].where).toEqual({ deletedAt: null });
      expect(second[0].where).toEqual({ deletedAt: null, group: 'SECURITY' });
    });
  });

  describe('create', () => {
    it('creates an option and writes a log', async () => {
      prismaMock.qsOption.findFirst.mockResolvedValue(null);
      prismaMock.qsOption.create.mockResolvedValue({
        id: 'o-1',
        group: 'SECURITY',
        value: 'MSIG',
      });

      await service.create({ group: 'SECURITY', value: 'MSIG' }, actor);

      expect(prismaMock.qsOption.findFirst).toHaveBeenCalledWith({
        where: {
          group: 'SECURITY',
          value: { equals: 'MSIG', mode: 'insensitive' },
          deletedAt: null,
        },
        select: { id: true },
      });
      expect(prismaMock.log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CREATE',
          referenceId: 'o-1',
          referenceType: 'QS_TEMPLATE',
        }),
      });
    });

    it('rejects a duplicate value in the same group', async () => {
      prismaMock.qsOption.findFirst.mockResolvedValue({ id: 'o-1' });

      await expect(
        service.create({ group: 'SECURITY', value: 'msig' }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.qsOption.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404s when the option is missing or deleted', async () => {
      prismaMock.qsOption.findFirst.mockResolvedValue(null);

      await expect(
        service.update('o-1', { label: 'x' }, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('checks uniqueness against other options when the value changes', async () => {
      prismaMock.qsOption.findFirst
        .mockResolvedValueOnce({ id: 'o-1', group: 'SECURITY', value: 'A' })
        .mockResolvedValueOnce({ id: 'o-2' });

      await expect(
        service.update('o-1', { value: 'HYDOR' }, actor),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.qsOption.findFirst.mock.calls[1][0].where).toEqual({
        group: 'SECURITY',
        value: { equals: 'HYDOR', mode: 'insensitive' },
        deletedAt: null,
        id: { not: 'o-1' },
      });
    });

    it('only writes the fields that were sent', async () => {
      prismaMock.qsOption.findFirst.mockResolvedValue({
        id: 'o-1',
        group: 'SECURITY',
        value: 'MSIG',
      });
      prismaMock.qsOption.update.mockResolvedValue({
        id: 'o-1',
        group: 'SECURITY',
        value: 'MSIG',
      });

      await service.update('o-1', { isActive: false }, actor);

      expect(prismaMock.qsOption.update).toHaveBeenCalledWith({
        where: { id: 'o-1' },
        data: { isActive: false },
      });
    });
  });

  describe('remove', () => {
    it('soft deletes and logs', async () => {
      prismaMock.qsOption.findFirst.mockResolvedValue({
        id: 'o-1',
        group: 'SECURITY',
        value: 'MSIG',
      });

      await service.remove('o-1', actor);

      expect(prismaMock.qsOption.update).toHaveBeenCalledWith({
        where: { id: 'o-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prismaMock.log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'DELETE',
          referenceType: 'QS_TEMPLATE',
        }),
      });
    });
  });

  describe('validation', () => {
    it('normalises group to upper snake case and trims value', () => {
      const parsed = createQsOptionSchema.parse({
        group: ' premium warranty ',
        value: '  30 days  ',
      });

      expect(parsed.group).toBe('PREMIUM_WARRANTY');
      expect(parsed.value).toBe('30 days');
    });

    it('rejects empty values and empty updates', () => {
      expect(
        createQsOptionSchema.safeParse({ group: 'SECURITY', value: '  ' })
          .success,
      ).toBe(false);
      expect(updateQsOptionSchema.safeParse({}).success).toBe(false);
    });
  });
});
