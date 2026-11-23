import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { PlacementService } from './placement.service';
import { replacePlacementSchema } from './policies.validation';

const item = (
  insuranceCompanyId: string,
  role: 'LEADER' | 'MEMBER',
  share: number,
) => ({ insuranceCompanyId, role, share });

describe('replacePlacementSchema', () => {
  const ok = (participants: unknown[]) =>
    replacePlacementSchema.safeParse({ participants });

  it('accepts one leader and a total of exactly 100', () => {
    expect(ok([item('a', 'LEADER', 60), item('b', 'MEMBER', 40)]).success).toBe(
      true,
    );
  });

  it('sums in hundredths, so 33.33 + 33.33 + 33.34 is 100', () => {
    expect(
      ok([
        item('a', 'LEADER', 33.33),
        item('b', 'MEMBER', 33.33),
        item('c', 'MEMBER', 33.34),
      ]).success,
    ).toBe(true);
    // A raw float sum of these is 100.00000000000001 or similar.
    expect(
      ok([
        item('a', 'LEADER', 0.1),
        item('b', 'MEMBER', 0.2),
        item('c', 'MEMBER', 99.7),
      ]).success,
    ).toBe(true);
  });

  it('rejects a total different from 100', () => {
    expect(
      ok([item('a', 'LEADER', 60), item('b', 'MEMBER', 39.99)]).success,
    ).toBe(false);
    expect(
      ok([item('a', 'LEADER', 60), item('b', 'MEMBER', 40.01)]).success,
    ).toBe(false);
  });

  it('requires exactly one leader', () => {
    expect(ok([item('a', 'MEMBER', 50), item('b', 'MEMBER', 50)]).success).toBe(
      false,
    );
    expect(ok([item('a', 'LEADER', 50), item('b', 'LEADER', 50)]).success).toBe(
      false,
    );
  });

  it('rejects the same company twice', () => {
    expect(ok([item('a', 'LEADER', 50), item('a', 'MEMBER', 50)]).success).toBe(
      false,
    );
  });

  it('rejects zero, negative, over 100 and 3-decimal shares', () => {
    expect(ok([item('a', 'LEADER', 0)]).success).toBe(false);
    expect(ok([item('a', 'LEADER', -5)]).success).toBe(false);
    expect(ok([item('a', 'LEADER', 100.01)]).success).toBe(false);
    expect(
      ok([item('a', 'LEADER', 50.005), item('b', 'MEMBER', 49.995)]).success,
    ).toBe(false);
  });

  it('accepts a single leader holding 100', () => {
    expect(ok([item('a', 'LEADER', 100)]).success).toBe(true);
  });

  it('rejects an empty list', () => {
    expect(ok([]).success).toBe(false);
  });
});

describe('PlacementService', () => {
  let service: PlacementService;

  const prismaMock = {
    quotation: { findFirst: vi.fn() },
    policy: { findFirst: vi.fn() },
    policyParticipant: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
    },
    insuranceCompany: { findMany: vi.fn() },
    user: { findFirst: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const actor = { id: 'user-1', fullname: 'User Test' };
  const quotation = {
    id: 'q-1',
    quotationNumber: 'QTN-1',
    status: 'INSURANCE_APPROVED',
    technicalUnitId: null,
  };
  const dto = {
    participants: [item('a', 'LEADER', 60), item('b', 'MEMBER', 40)],
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PlacementService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(PlacementService);
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.quotation.findFirst.mockResolvedValue(quotation);
    prismaMock.insuranceCompany.findMany.mockResolvedValue([
      { id: 'a' },
      { id: 'b' },
    ]);
    prismaMock.policy.findFirst.mockResolvedValue(null);
    prismaMock.policyParticipant.findMany.mockResolvedValue([]);
  });

  describe('get', () => {
    it('rejects an unknown quotation', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(null);
      await expect(service.get('x')).rejects.toThrow(NotFoundException);
    });

    it('lists the leader first and reports the total', async () => {
      prismaMock.policyParticipant.findMany.mockResolvedValue([
        { role: 'MEMBER', share: '40.00' },
        { role: 'LEADER', share: '60.00' },
      ]);

      const result = await service.get('q-1');

      expect(result.participants[0].role).toBe('LEADER');
      expect(result.totalShare).toBe(100);
      expect(result.isComplete).toBe(true);
    });

    it('is incomplete when the total is not 100', async () => {
      prismaMock.policyParticipant.findMany.mockResolvedValue([
        { role: 'LEADER', share: '60.00' },
      ]);
      const result = await service.get('q-1');
      expect(result.totalShare).toBe(60);
      expect(result.isComplete).toBe(false);
    });
  });

  describe('replace', () => {
    it('rejects a quotation that is not insurance-approved', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue({
        ...quotation,
        status: 'SENT_TO_INSURANCE',
      });
      await expect(service.replace('q-1', dto, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an actor from another technical unit', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue({
        ...quotation,
        technicalUnitId: 'unit-hm',
      });
      prismaMock.user.findFirst.mockResolvedValue({
        role: 'USER',
        organizationUnitId: 'unit-cargo',
      });

      await expect(service.replace('q-1', dto, actor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets a SUPERADMIN replace another unit placement', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue({
        ...quotation,
        technicalUnitId: 'unit-hm',
      });
      prismaMock.user.findFirst.mockResolvedValue({
        role: 'SUPERADMIN',
        organizationUnitId: null,
      });

      await service.replace('q-1', dto, actor);
      expect(prismaMock.policyParticipant.createMany).toHaveBeenCalled();
    });

    it('rejects a company that does not exist or is deleted', async () => {
      prismaMock.insuranceCompany.findMany.mockResolvedValue([{ id: 'a' }]);
      await expect(service.replace('q-1', dto, actor)).rejects.toThrow(
        'Insurance company not found',
      );
    });

    it('rejects once the placement is completed', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({
        id: 'p-1',
        status: 'PLACEMENT_COMPLETED',
      });
      await expect(service.replace('q-1', dto, actor)).rejects.toThrow(
        'Placement is already completed',
      );
      expect(prismaMock.policyParticipant.createMany).not.toHaveBeenCalled();
    });

    it('soft deletes the old rows and creates the new ones with the policy id', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue({
        ...quotation,
        status: 'POLICY_ISSUED',
      });
      prismaMock.policy.findFirst.mockResolvedValue({
        id: 'p-1',
        status: 'POLICY_ISSUED',
      });

      await service.replace('q-1', dto, actor);

      expect(
        prismaMock.policyParticipant.updateMany.mock.calls[0][0].data.deletedAt,
      ).toBeInstanceOf(Date);
      const rows =
        prismaMock.policyParticipant.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        quotationId: 'q-1',
        policyId: 'p-1',
        insuranceCompanyId: 'a',
        role: 'LEADER',
        orderNo: 1,
      });
      expect(rows[0].share.toString()).toBe('60');
      expect(prismaMock.log.create.mock.calls[0][0].data.referenceType).toBe(
        'POLICY_PLACEMENT',
      );
    });

    it('leaves policyId empty before the policy exists', async () => {
      await service.replace('q-1', dto, actor);
      expect(
        prismaMock.policyParticipant.createMany.mock.calls[0][0].data[0]
          .policyId,
      ).toBeNull();
    });
  });
});
