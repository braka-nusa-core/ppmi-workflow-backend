import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { ClubsService } from './clubs.service';

describe('ClubsService', () => {
  let service: ClubsService;
  const prismaMock = {
    club: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    log: { create: vi.fn() },
    pniQuotation: { count: vi.fn() },
    qsTemplate: { count: vi.fn() },
    $transaction: vi.fn(),
  };

  const actor = { id: 'user-1', fullname: 'User Test' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ClubsService>(ClubsService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
  });

  describe('update', () => {
    it('rejects a code change when the club is already used', async () => {
      prismaMock.club.findFirst.mockResolvedValue({ id: 'club-1', code: 'MSIG' });
      prismaMock.pniQuotation.count.mockResolvedValue(1);
      prismaMock.qsTemplate.count.mockResolvedValue(0);

      await expect(
        service.update('club-1', { code: 'MSIG2' }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.club.update).not.toHaveBeenCalled();
    });

    it('allows a name change when the club is already used and logs it', async () => {
      prismaMock.club.findFirst.mockResolvedValue({ id: 'club-1', code: 'MSIG' });
      prismaMock.club.update.mockResolvedValue({
        id: 'club-1',
        code: 'MSIG',
        name: 'MSIG Specialty',
      });

      const result = await service.update(
        'club-1',
        { name: 'MSIG Specialty' },
        actor,
      );

      expect(result.name).toBe('MSIG Specialty');
      expect(prismaMock.pniQuotation.count).not.toHaveBeenCalled();
      expect(prismaMock.log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'UPDATE',
          referenceType: 'CLUB',
          userId: 'user-1',
        }),
      });
    });
  });

  describe('create', () => {
    it('rejects a code that already exists, including soft-deleted clubs', async () => {
      prismaMock.club.findFirst.mockResolvedValue({ id: 'club-9' });

      await expect(
        service.create({ code: 'INIGO', name: 'Inigo' }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.club.create).not.toHaveBeenCalled();
    });
  });
});
