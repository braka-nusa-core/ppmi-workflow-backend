import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VesselRequirementsService,
  evaluateChecklist,
} from './vessel-requirements.service';
import { createVesselRequirementSchema } from './vessel-requirements.validation';

const NOW = new Date('2026-11-23T00:00:00Z');
const requirement = (category: string) => ({
  id: `req-${category}`,
  category,
  label: null,
});
const document = (
  id: string,
  category: string,
  validUntil: string | null,
  status = 'AVAILABLE',
) => ({
  id,
  category,
  status,
  validUntil: validUntil ? new Date(validUntil) : null,
});

describe('evaluateChecklist', () => {
  it('marks a category with no document as MISSING', () => {
    const result = evaluateChecklist([requirement('SURAT_LAUT')], [], NOW, 7);

    expect(result.items[0]).toMatchObject({
      status: 'MISSING',
      documentId: null,
    });
    expect(result.summary).toMatchObject({
      required: 1,
      missing: 1,
      complete: false,
    });
  });

  it('treats a document without an expiry date as OK', () => {
    const result = evaluateChecklist(
      [requirement('SURAT_LAUT')],
      [document('d1', 'SURAT_LAUT', null)],
      NOW,
      7,
    );

    expect(result.items[0].status).toBe('OK');
    expect(result.summary.complete).toBe(true);
  });

  it('flags a document that expires inside the window but still counts it as complete', () => {
    const result = evaluateChecklist(
      [requirement('CLASS')],
      [document('d1', 'CLASS', '2026-11-27')],
      NOW,
      7,
    );

    expect(result.items[0]).toMatchObject({
      status: 'EXPIRING_SOON',
      documentId: 'd1',
    });
    expect(result.summary).toMatchObject({ expiringSoon: 1, complete: true });
  });

  it('reports EXPIRED when every document of the category is past its date', () => {
    const result = evaluateChecklist(
      [requirement('CLASS')],
      [document('d1', 'CLASS', '2026-10-01')],
      NOW,
      7,
    );

    expect(result.items[0]).toMatchObject({
      status: 'EXPIRED',
      documentId: null,
    });
    expect(result.summary.complete).toBe(false);
  });

  it('treats a document with status EXPIRED as expired even when its date is later', () => {
    const result = evaluateChecklist(
      [requirement('CLASS')],
      [document('d1', 'CLASS', '2027-06-01', 'EXPIRED')],
      NOW,
      7,
    );

    expect(result.items[0].status).toBe('EXPIRED');
  });

  it('uses the longest-lasting valid document when there are several', () => {
    const result = evaluateChecklist(
      [requirement('PHOTO')],
      [
        document('old', 'PHOTO', '2026-12-31'),
        document('new', 'PHOTO', '2027-12-31'),
        document('gone', 'PHOTO', '2026-01-01'),
      ],
      NOW,
      7,
    );

    expect(result.items[0]).toMatchObject({ status: 'OK', documentId: 'new' });
  });

  it('prefers a document that never expires over one with a date', () => {
    const result = evaluateChecklist(
      [requirement('PHOTO')],
      [
        document('dated', 'PHOTO', '2030-01-01'),
        document('forever', 'PHOTO', null),
      ],
      NOW,
      7,
    );

    expect(result.items[0].documentId).toBe('forever');
  });

  it('is complete when nothing is required', () => {
    const result = evaluateChecklist([], [], NOW, 7);

    expect(result.summary).toEqual({
      required: 0,
      ok: 0,
      expiringSoon: 0,
      expired: 0,
      missing: 0,
      complete: true,
    });
  });
});

describe('VesselRequirementsService', () => {
  const prismaMock = {
    vessel: { findFirst: vi.fn() },
    vesselDocument: { findMany: vi.fn() },
    vesselDocumentRequirement: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const actor = { id: 'user-1', fullname: 'User Test' };
  let service: VesselRequirementsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    service = new VesselRequirementsService(prismaMock as any);
  });

  describe('create', () => {
    it('rejects a duplicate category for the same vessel type, ignoring case', async () => {
      prismaMock.vesselDocumentRequirement.findMany.mockResolvedValue([
        { vesselType: 'tug  boat' },
      ]);

      await expect(
        service.create({ category: 'CLASS', vesselType: 'TUG BOAT' }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(
        prismaMock.vesselDocumentRequirement.create,
      ).not.toHaveBeenCalled();
    });

    it('rejects a second "all vessels" requirement for the same category', async () => {
      prismaMock.vesselDocumentRequirement.findMany.mockResolvedValue([
        { vesselType: null },
      ]);

      await expect(
        service.create({ category: 'CLASS' }, actor),
      ).rejects.toThrow('already required');
    });

    it('allows the same category for a different vessel type', async () => {
      prismaMock.vesselDocumentRequirement.findMany.mockResolvedValue([
        { vesselType: null },
      ]);
      prismaMock.vesselDocumentRequirement.create.mockResolvedValue({
        id: 'r1',
        category: 'CLASS',
      });

      await service.create({ category: 'CLASS', vesselType: 'BARGE' }, actor);

      expect(prismaMock.vesselDocumentRequirement.create).toHaveBeenCalled();
      expect(prismaMock.log.create).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('rejects an unknown requirement', async () => {
      prismaMock.vesselDocumentRequirement.findFirst.mockResolvedValue(null);

      await expect(service.delete('missing', actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('soft deletes the requirement', async () => {
      prismaMock.vesselDocumentRequirement.findFirst.mockResolvedValue({
        id: 'r1',
        category: 'CLASS',
      });

      await expect(service.delete('r1', actor)).resolves.toEqual({ id: 'r1' });
      expect(prismaMock.vesselDocumentRequirement.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('checklist', () => {
    it('rejects an unknown vessel', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(null);

      await expect(service.checklist('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not query documents when nothing is required', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue({
        id: 'v1',
        name: 'KAIROS JAYA',
        vesselType: 'BARGE',
      });
      prismaMock.vesselDocumentRequirement.findMany.mockResolvedValue([]);

      const result = await service.checklist('v1', NOW);

      expect(prismaMock.vesselDocument.findMany).not.toHaveBeenCalled();
      expect(result.summary.complete).toBe(true);
    });

    it('only applies requirements that match the vessel type', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue({
        id: 'v1',
        name: 'KAIROS JAYA',
        vesselType: ' tug boat ',
      });
      prismaMock.vesselDocumentRequirement.findMany.mockResolvedValue([
        { id: 'all', category: 'CLASS', label: null, vesselType: null },
        {
          id: 'tug',
          category: 'SURAT_LAUT',
          label: null,
          vesselType: 'TUG BOAT',
        },
        { id: 'barge', category: 'AKTA', label: null, vesselType: 'BARGE' },
      ]);
      prismaMock.vesselDocument.findMany.mockResolvedValue([]);

      const result = await service.checklist('v1', NOW);

      expect(result.items.map((item) => item.category)).toEqual([
        'CLASS',
        'SURAT_LAUT',
      ]);
      expect(prismaMock.vesselDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { in: ['CLASS', 'SURAT_LAUT'] },
          }),
        }),
      );
    });
  });
});

describe('createVesselRequirementSchema', () => {
  it('normalises the category like a vessel document category', () => {
    expect(
      createVesselRequirementSchema.parse({ category: ' surat laut ' })
        .category,
    ).toBe('SURAT_LAUT');
  });
});
