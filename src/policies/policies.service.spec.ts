import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { PoliciesService } from './policies.service';
import { issuePolicySchema, updatePolicySchema } from './policies.validation';

describe('policy schemas', () => {
  it('requires a policy number, treating an empty string as missing', () => {
    expect(issuePolicySchema.safeParse({}).success).toBe(false);
    expect(issuePolicySchema.safeParse({ policyNumber: '' }).success).toBe(
      false,
    );
    expect(
      issuePolicySchema.safeParse({ policyNumber: 'POL-1', policyDate: '' })
        .success,
    ).toBe(true);
  });

  it('rejects a period that ends before it starts', () => {
    const result = issuePolicySchema.safeParse({
      policyNumber: 'POL-1',
      periodStart: '2026-12-01',
      periodEnd: '2026-11-01',
    });
    expect(result.success).toBe(false);
    expect(
      updatePolicySchema.safeParse({
        periodStart: '2026-12-01',
        periodEnd: '2026-11-01',
      }).success,
    ).toBe(false);
  });
});

describe('PoliciesService', () => {
  let service: PoliciesService;

  const prismaMock = {
    quotation: { findFirst: vi.fn(), updateMany: vi.fn() },
    quotationHistory: { create: vi.fn() },
    policy: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    policyParticipant: { findMany: vi.fn(), updateMany: vi.fn() },
    policyHistory: { create: vi.fn() },
    user: { findFirst: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const storageMock = { upload: vi.fn() };

  const actor = { id: 'user-1', fullname: 'User Test' };
  const file = {
    originalname: 'polis.pdf',
    mimetype: 'application/pdf',
    size: 10,
    buffer: Buffer.from('x'),
  } as Express.Multer.File;
  const quotation = {
    id: 'q-1',
    quotationNumber: 'QTN-1',
    status: 'INSURANCE_APPROVED',
    technicalUnitId: null,
    insuranceTypeId: 'it-1',
  };
  const policy = {
    id: 'p-1',
    quotationId: 'q-1',
    policyNumber: 'POL-1',
    status: 'POLICY_ISSUED',
    periodStart: null,
    periodEnd: null,
    quotation: { technicalUnitId: null },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PoliciesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();
    service = module.get(PoliciesService);
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
  });

  describe('issue', () => {
    beforeEach(() => {
      prismaMock.quotation.findFirst.mockResolvedValue(quotation);
      prismaMock.policy.findFirst.mockResolvedValue(null);
      prismaMock.quotation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.policy.create.mockResolvedValue({
        id: 'p-1',
        policyNumber: 'POL-1',
      });
      storageMock.upload.mockResolvedValue('https://s3/polis.pdf');
    });

    it('rejects an unknown quotation', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(null);
      await expect(
        service.issue('q-1', { policyNumber: 'POL-1' }, file, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a quotation that is not INSURANCE_APPROVED', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue({
        ...quotation,
        status: 'POLICY_ISSUED',
      });
      await expect(
        service.issue('q-1', { policyNumber: 'POL-1' }, file, actor),
      ).rejects.toThrow(BadRequestException);
      expect(storageMock.upload).not.toHaveBeenCalled();
    });

    it('rejects when the quotation already has a policy', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({ id: 'old' });
      await expect(
        service.issue('q-1', { policyNumber: 'POL-1' }, file, actor),
      ).rejects.toThrow('Quotation already has a policy');
    });

    it('rejects an actor from another technical unit', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue({
        ...quotation,
        technicalUnitId: 'unit-hm',
      });
      prismaMock.user.findFirst.mockResolvedValue({
        role: 'USER',
        organizationUnitId: 'unit-pni',
      });
      await expect(
        service.issue('q-1', { policyNumber: 'POL-1' }, file, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('issues the policy, links participants, moves the quotation and records history', async () => {
      await service.issue(
        'q-1',
        { policyNumber: 'POL-1', periodStart: new Date('2026-12-01') },
        file,
        actor,
      );

      const key = storageMock.upload.mock.calls[0][0] as string;
      expect(key).toMatch(/^policies\/q-1\/[0-9a-f-]+\.pdf$/);

      expect(prismaMock.quotation.updateMany).toHaveBeenCalledWith({
        where: { id: 'q-1', deletedAt: null, status: 'INSURANCE_APPROVED' },
        data: { status: 'POLICY_ISSUED' },
      });
      expect(prismaMock.policy.create.mock.calls[0][0].data).toMatchObject({
        quotationId: 'q-1',
        insuranceTypeId: 'it-1',
        issuedById: 'user-1',
        status: 'POLICY_ISSUED',
        policyDocumentUrl: 'https://s3/polis.pdf',
        policyDocumentName: 'polis.pdf',
      });
      expect(prismaMock.policyParticipant.updateMany).toHaveBeenCalledWith({
        where: { quotationId: 'q-1', deletedAt: null },
        data: { policyId: 'p-1' },
      });
      expect(
        prismaMock.quotationHistory.create.mock.calls[0][0].data,
      ).toMatchObject({ action: 'ISSUE_POLICY', toStatus: 'POLICY_ISSUED' });
      expect(
        prismaMock.policyHistory.create.mock.calls[0][0].data,
      ).toMatchObject({ action: 'ISSUE', toStatus: 'POLICY_ISSUED' });
      expect(prismaMock.log.create).toHaveBeenCalled();
    });

    it('works without a document', async () => {
      await service.issue('q-1', { policyNumber: 'POL-1' }, undefined, actor);
      expect(storageMock.upload).not.toHaveBeenCalled();
    });

    it('fails when the quotation changed concurrently', async () => {
      prismaMock.quotation.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.issue('q-1', { policyNumber: 'POL-1' }, undefined, actor),
      ).rejects.toThrow('changed concurrently');
      expect(prismaMock.policy.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects once placement is completed', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({
        ...policy,
        status: 'PLACEMENT_COMPLETED',
      });
      await expect(
        service.update('p-1', { policyNumber: 'POL-2' }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('checks the period against the stored dates', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({
        ...policy,
        periodStart: new Date('2026-12-01'),
      });
      await expect(
        service.update('p-1', { periodEnd: new Date('2026-11-01') }, actor),
      ).rejects.toThrow('periodEnd must not be earlier');
    });

    it('updates guarded by the POLICY_ISSUED status', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(policy);
      prismaMock.policy.updateMany.mockResolvedValue({ count: 1 });

      await service.update('p-1', { policyNumber: 'POL-2' }, actor);

      expect(prismaMock.policy.updateMany.mock.calls[0][0].where).toMatchObject(
        {
          id: 'p-1',
          status: 'POLICY_ISSUED',
        },
      );
    });
  });

  describe('uploadDocument', () => {
    it('uploads under policies/{quotationId}/ and stores name and url', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(policy);
      storageMock.upload.mockResolvedValue('https://s3/new.pdf');
      prismaMock.policy.update.mockResolvedValue({});

      await service.uploadDocument('p-1', file, actor);

      expect(storageMock.upload.mock.calls[0][0]).toMatch(/^policies\/q-1\//);
      expect(prismaMock.policy.update.mock.calls[0][0].data).toEqual({
        policyDocumentUrl: 'https://s3/new.pdf',
        policyDocumentName: 'polis.pdf',
      });
    });
  });

  describe('completePlacement', () => {
    const complete = [
      { role: 'LEADER', share: '60.00' },
      { role: 'MEMBER', share: '40.00' },
    ];

    it('rejects a policy that is not POLICY_ISSUED', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({
        ...policy,
        status: 'PLACEMENT_COMPLETED',
      });
      await expect(service.completePlacement('p-1', actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an incomplete placement', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(policy);
      prismaMock.policyParticipant.findMany.mockResolvedValue([
        { role: 'LEADER', share: '60.00' },
        { role: 'MEMBER', share: '30.00' },
      ]);
      await expect(service.completePlacement('p-1', actor)).rejects.toThrow(
        'Placement must have one leader',
      );
      expect(prismaMock.policy.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a placement without a leader', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(policy);
      prismaMock.policyParticipant.findMany.mockResolvedValue([
        { role: 'MEMBER', share: '100.00' },
      ]);
      await expect(service.completePlacement('p-1', actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('completes, links participants and writes history', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(policy);
      prismaMock.policyParticipant.findMany.mockResolvedValue(complete);
      prismaMock.policy.updateMany.mockResolvedValue({ count: 1 });

      await service.completePlacement('p-1', actor);

      const call = prismaMock.policy.updateMany.mock.calls[0][0];
      expect(call.where.status).toBe('POLICY_ISSUED');
      expect(call.data.status).toBe('PLACEMENT_COMPLETED');
      expect(call.data.placementCompletedAt).toBeInstanceOf(Date);
      expect(prismaMock.policyParticipant.updateMany).toHaveBeenCalledWith({
        where: { quotationId: 'q-1', deletedAt: null },
        data: { policyId: 'p-1' },
      });
      expect(
        prismaMock.policyHistory.create.mock.calls[0][0].data,
      ).toMatchObject({
        fromStatus: 'POLICY_ISSUED',
        toStatus: 'PLACEMENT_COMPLETED',
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
    });

    it('fails on a concurrent status change', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(policy);
      prismaMock.policyParticipant.findMany.mockResolvedValue(complete);
      prismaMock.policy.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.completePlacement('p-1', actor)).rejects.toThrow(
        'changed concurrently',
      );
    });
  });

  describe('list', () => {
    it('applies the filters and hides deleted policies', async () => {
      prismaMock.policy.findMany.mockResolvedValue([]);
      prismaMock.policy.count.mockResolvedValue(0);

      await service.list({
        status: 'POLICY_ISSUED',
        insuranceTypeId: 'it-1',
        quotationId: 'q-1',
        q: 'pol',
        page: 2,
        limit: 10,
      });

      const args = prismaMock.policy.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({
        deletedAt: null,
        status: 'POLICY_ISSUED',
        insuranceTypeId: 'it-1',
        quotationId: 'q-1',
        policyNumber: { contains: 'pol' },
      });
      expect(args.skip).toBe(10);
    });
  });
});
