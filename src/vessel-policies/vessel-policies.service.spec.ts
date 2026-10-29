import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { VesselPoliciesService } from './vessel-policies.service';

describe('VesselPoliciesService', () => {
  let service: VesselPoliciesService;
  const prismaMock = {
    vessel: { findFirst: vi.fn() },
    client: { findFirst: vi.fn() },
    vesselPolicy: {
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
        VesselPoliciesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<VesselPoliciesService>(VesselPoliciesService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
  });

  describe('create', () => {
    it('rejects an unknown vessel', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ vesselId: 'missing', clientId: 'client-1' }, actor),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.vesselPolicy.create).not.toHaveBeenCalled();
    });

    it('rejects a second policy for the same vessel, number, and period start', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue({ id: 'vessel-1', name: 'SAMUDRA III' });
      prismaMock.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prismaMock.vesselPolicy.findFirst.mockResolvedValue({ id: 'policy-9' });

      await expect(
        service.create(
          {
            vesselId: 'vessel-1',
            clientId: 'client-1',
            policyNumber: 'SO003288-0001',
            periodStart: new Date('2026-02-20'),
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.vesselPolicy.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('recalculates the coverage key when the policy number changes', async () => {
      prismaMock.vesselPolicy.findFirst.mockResolvedValueOnce({
        vesselId: 'vessel-1',
        policyNumber: '50020907-2',
        periodStart: new Date('2026-09-01'),
        coverageKey: 'old-key',
      });
      prismaMock.vesselPolicy.findFirst.mockResolvedValueOnce(null);
      prismaMock.vesselPolicy.update.mockResolvedValue({ id: 'policy-1' });

      await service.update('policy-1', { policyNumber: '5O020626/2026' }, actor);

      expect(prismaMock.vesselPolicy.update).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
        data: expect.objectContaining({
          policyNumber: '50020626/2026',
          coverageKey: expect.any(String),
        }),
        select: expect.any(Object),
      });
    });
  });
});
