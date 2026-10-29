import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { VesselsService } from './vessels.service';

describe('VesselsService', () => {
  let service: VesselsService;
  const prismaMock = {
    vessel: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    vesselPolicy: { count: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };

  const actor = { id: 'user-1', fullname: 'User Test' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VesselsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<VesselsService>(VesselsService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
  });

  describe('create', () => {
    it('rejects a vessel with the same name, build year, and GRT', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue({ id: 'vessel-9' });

      await expect(
        service.create({ name: 'buana harbour 3201', builtYear: 2018, grossTonnage: 354 }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.vessel.create).not.toHaveBeenCalled();
    });

    it('stores the normalized name and identity key', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(null);
      prismaMock.vessel.create.mockResolvedValue({ id: 'vessel-1' });

      await service.create({ name: '  buana   harbour 3201 ', builtYear: 2018, grossTonnage: 354 }, actor);

      expect(prismaMock.vessel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'buana   harbour 3201',
          normalizedName: 'BUANA HARBOUR 3201',
          identityKey: expect.any(String),
        }),
        select: expect.any(Object),
      });
    });
  });

  describe('delete', () => {
    it('blocks deletion when the vessel still has active policies', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue({ id: 'vessel-1', name: 'KAIROS JAYA' });
      prismaMock.vesselPolicy.count.mockResolvedValue(2);

      await expect(service.delete('vessel-1', actor)).rejects.toThrow(BadRequestException);
      expect(prismaMock.vessel.update).not.toHaveBeenCalled();
    });
  });
});
