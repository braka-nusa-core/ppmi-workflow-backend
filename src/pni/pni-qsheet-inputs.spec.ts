import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotationsService } from '../quotations/quotations.service';
import {
  createQuotationSchema,
  updateQuotationSchema,
} from '../quotations/quotations.validation';
import { PniService } from './pni.service';
import { updatePniQuotationSchema } from './pni.validation';

describe('P&I QSheet inputs', () => {
  const service = new PniService({} as any, {} as any);
  const pniData = (input: object, scope?: string | null) =>
    (service as any).pniData(input, scope);

  describe('pniData', () => {
    it('maps the new fields and converts referenceDate', () => {
      const data = pniData({
        referenceDate: '2026-11-18',
        vesselScope: 'FLEET',
        declaredVesselCount: 12,
        coverType: 'FULL',
        premiumType: 'MUTUAL',
      });

      expect(data).toEqual({
        referenceDate: new Date('2026-11-18'),
        vesselScope: 'FLEET',
        declaredVesselCount: 12,
        coverType: 'FULL',
        premiumType: 'MUTUAL',
      });
    });

    it('rejects declaredVesselCount for a SINGLE vessel scope', () => {
      expect(() =>
        pniData({ vesselScope: 'SINGLE', declaredVesselCount: 3 }),
      ).toThrow(BadRequestException);
    });

    it('rejects declaredVesselCount when the stored scope is not FLEET', () => {
      expect(() => pniData({ declaredVesselCount: 3 }, 'SINGLE')).toThrow(
        BadRequestException,
      );
      expect(() => pniData({ declaredVesselCount: 3 }, null)).toThrow(
        BadRequestException,
      );
    });

    it('accepts declaredVesselCount against a stored FLEET scope', () => {
      expect(pniData({ declaredVesselCount: 5 }, 'FLEET')).toEqual({
        declaredVesselCount: 5,
      });
    });

    it('stores null count when the scope becomes SINGLE', () => {
      expect(pniData({ vesselScope: 'SINGLE' }, 'FLEET')).toEqual({
        vesselScope: 'SINGLE',
        declaredVesselCount: null,
      });
    });

    it('clears fields with null', () => {
      expect(
        pniData({ referenceDate: null, coverType: null, premiumType: null }),
      ).toEqual({ referenceDate: null, coverType: null, premiumType: null });
    });

    it('leaves untouched fields out', () => {
      expect(pniData({ referenceNumber: 'REF-1' })).toEqual({
        referenceNumber: 'REF-1',
      });
    });
  });

  describe('update validation', () => {
    it('accepts null and rejects a count below 1', () => {
      expect(
        updatePniQuotationSchema.safeParse({
          pni: { vesselScope: null, declaredVesselCount: null },
        }).success,
      ).toBe(true);
      expect(
        updatePniQuotationSchema.safeParse({
          pni: { declaredVesselCount: 0 },
        }).success,
      ).toBe(false);
    });
  });

  describe('getTemplate', () => {
    const prisma = {
      club: { findFirst: vi.fn() },
      qsTemplate: { findMany: vi.fn() },
    };
    let svc: PniService;

    beforeEach(() => {
      vi.clearAllMocks();
      prisma.club.findFirst.mockResolvedValue({ id: 'club-1' });
      svc = new PniService(prisma as any, {} as any);
    });

    it('keeps the old behaviour without coverType', async () => {
      prisma.qsTemplate.findMany.mockResolvedValue([]);

      await svc.getTemplate('MSIG');

      expect(prisma.qsTemplate.findMany).toHaveBeenCalledWith({
        where: { clubId: 'club-1', deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('filters by cover type or generic and puts exact matches first', async () => {
      prisma.qsTemplate.findMany.mockResolvedValue([
        { id: 'generic', coverType: null },
        { id: 'full-1', coverType: 'FULL' },
        { id: 'full-2', coverType: 'FULL' },
      ]);

      const result = await svc.getTemplate('MSIG', 'FULL');

      expect(prisma.qsTemplate.findMany.mock.calls[0][0].where).toEqual({
        clubId: 'club-1',
        deletedAt: null,
        OR: [{ coverType: 'FULL' }, { coverType: null }],
      });
      expect(result.map((t: any) => t.id)).toEqual([
        'full-1',
        'full-2',
        'generic',
      ]);
    });
  });

  describe('quotation voyageType', () => {
    const actor = { id: 'u', fullname: 'U' };

    it('is optional on create and nullable on update', () => {
      const base = { clientId: 'c-1', insuranceTypeId: 'i-1' };
      expect(createQuotationSchema.safeParse(base).success).toBe(true);
      expect(
        createQuotationSchema.safeParse({
          ...base,
          voyageType: 'SINGLE_VOYAGE',
        }).success,
      ).toBe(true);
      expect(
        createQuotationSchema.safeParse({ ...base, voyageType: 'OTHER' })
          .success,
      ).toBe(false);
      expect(
        updateQuotationSchema.safeParse({ voyageType: null }).success,
      ).toBe(true);
    });

    describe('QuotationsService.update', () => {
      const prisma = {
        quotation: { updateMany: vi.fn(), update: vi.fn() },
        log: { create: vi.fn() },
        $transaction: vi.fn(),
      };
      let quotations: QuotationsService;

      beforeEach(() => {
        vi.clearAllMocks();
        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
        prisma.quotation.updateMany.mockResolvedValue({ count: 1 });
        prisma.quotation.update.mockResolvedValue({ id: 'q-1' });
        quotations = new QuotationsService(prisma as any, {} as any, {} as any);
        vi.spyOn(quotations as any, 'assertEditable').mockResolvedValue({
          status: 'DRAFT',
        });
        vi.spyOn(quotations as any, 'assertActiveReferences').mockResolvedValue(
          undefined,
        );
      });

      it('writes voyageType only when it is sent, null clears it', async () => {
        await quotations.update(
          'q-1',
          { voyageType: 'UNDER_VOYAGE' } as any,
          actor,
        );
        await quotations.update('q-1', { voyageType: null } as any, actor);
        await quotations.update('q-1', { insured: 'X' } as any, actor);

        const [a, b, c] = prisma.quotation.update.mock.calls.map(
          (call) => call[0].data,
        );
        expect(a.voyageType).toBe('UNDER_VOYAGE');
        expect(b.voyageType).toBeNull();
        expect('voyageType' in c).toBe(false);
      });
    });
  });
});
