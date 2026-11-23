import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { InsuranceCompaniesService } from './insurance-companies.service';
import {
  createInsuranceCompanySchema,
  listInsuranceCompaniesQuerySchema,
} from './insurance-companies.validation';

describe('InsuranceCompaniesService', () => {
  let service: InsuranceCompaniesService;

  const prismaMock = {
    insuranceCompany: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    policyParticipant: { count: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const actor = { id: 'user-1', fullname: 'User Test' };
  const company = { id: 'ic-1', code: 'ABC', name: 'PT Asuransi ABC' };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InsuranceCompaniesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(InsuranceCompaniesService);
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
  });

  describe('validation', () => {
    it('trims and uppercases the code', () => {
      const parsed = createInsuranceCompanySchema.parse({
        code: '  abc ',
        name: 'PT ABC',
      });
      expect(parsed.code).toBe('ABC');
    });

    it('requires code and name', () => {
      expect(
        createInsuranceCompanySchema.safeParse({ code: 'A' }).success,
      ).toBe(false);
      expect(
        createInsuranceCompanySchema.safeParse({ name: 'A' }).success,
      ).toBe(false);
    });

    it('defaults paging', () => {
      expect(listInsuranceCompaniesQuerySchema.parse({})).toEqual({
        page: 1,
        limit: 50,
      });
    });
  });

  describe('list', () => {
    it('searches code and name and hides deleted rows', async () => {
      prismaMock.insuranceCompany.findMany.mockResolvedValue([company]);
      prismaMock.insuranceCompany.count.mockResolvedValue(1);

      const result = await service.list({ q: 'abc', page: 1, limit: 10 });

      const where = prismaMock.insuranceCompany.findMany.mock.calls[0][0].where;
      expect(where.deletedAt).toBeNull();
      expect(where.OR).toHaveLength(2);
      expect(result).toEqual({
        items: [company],
        total: 1,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('create', () => {
    it('rejects a code that is already taken', async () => {
      prismaMock.insuranceCompany.findFirst.mockResolvedValue({
        id: 'x',
        deletedAt: null,
      });

      await expect(
        service.create({ code: 'ABC', name: 'PT ABC' }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.insuranceCompany.create).not.toHaveBeenCalled();
    });

    it('creates the company and writes a log', async () => {
      prismaMock.insuranceCompany.findFirst.mockResolvedValue(null);
      prismaMock.insuranceCompany.create.mockResolvedValue(company);

      await service.create({ code: 'ABC', name: 'PT ABC' }, actor);

      expect(prismaMock.log.create.mock.calls[0][0].data).toMatchObject({
        action: 'CREATE',
        referenceType: 'INSURANCE_COMPANY',
      });
    });
  });

  describe('update', () => {
    it('rejects an unknown company', async () => {
      prismaMock.insuranceCompany.findFirst.mockResolvedValue(null);
      await expect(service.update('x', { name: 'N' }, actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects changing to a code used by another company', async () => {
      prismaMock.insuranceCompany.findFirst
        .mockResolvedValueOnce(company)
        .mockResolvedValueOnce({ id: 'other', deletedAt: null });

      await expect(
        service.update('ic-1', { code: 'XYZ' }, actor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('refuses while a participant uses the company', async () => {
      prismaMock.insuranceCompany.findFirst.mockResolvedValue(company);
      prismaMock.policyParticipant.count.mockResolvedValue(2);

      await expect(service.delete('ic-1', actor)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.policyParticipant.count).toHaveBeenCalledWith({
        where: { insuranceCompanyId: 'ic-1', deletedAt: null },
      });
      expect(prismaMock.insuranceCompany.update).not.toHaveBeenCalled();
    });

    it('soft deletes an unused company', async () => {
      prismaMock.insuranceCompany.findFirst.mockResolvedValue(company);
      prismaMock.policyParticipant.count.mockResolvedValue(0);

      await expect(service.delete('ic-1', actor)).resolves.toEqual({
        id: 'ic-1',
      });
      expect(
        prismaMock.insuranceCompany.update.mock.calls[0][0].data.deletedAt,
      ).toBeInstanceOf(Date);
    });
  });
});
