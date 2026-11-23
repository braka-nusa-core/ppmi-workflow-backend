import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VesselSurveysService } from './vessel-surveys.service';
import { createVesselSurveySchema } from './vessel-surveys.validation';

describe('VesselSurveysService', () => {
  const prismaMock = {
    vessel: { findFirst: vi.fn() },
    surveyor: { findFirst: vi.fn() },
    quotation: { findFirst: vi.fn() },
    vesselDocument: { findFirst: vi.fn() },
    vesselSurvey: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const actor = { id: 'user-1', fullname: 'User Test' };
  const vessel = { id: 'vessel-1', name: 'KAIROS JAYA' };
  let service: VesselSurveysService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.vessel.findFirst.mockResolvedValue(vessel);
    service = new VesselSurveysService(prismaMock as any);
  });

  it('rejects an unknown vessel', async () => {
    prismaMock.vessel.findFirst.mockResolvedValue(null);

    await expect(service.list('missing', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates a survey with the default PLANNED status', async () => {
    prismaMock.vesselSurvey.create.mockResolvedValue({
      id: 's-1',
      surveyType: null,
    });

    await service.create('vessel-1', {}, actor);

    expect(prismaMock.vesselSurvey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vesselId: 'vessel-1',
          status: 'PLANNED',
          createdById: 'user-1',
        }),
      }),
    );
    expect(prismaMock.log.create).toHaveBeenCalled();
  });

  it('rejects an unknown surveyor', async () => {
    prismaMock.surveyor.findFirst.mockResolvedValue(null);

    await expect(
      service.create('vessel-1', { surveyorId: 'sv-9' }, actor),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.vesselSurvey.create).not.toHaveBeenCalled();
  });

  it('only accepts a report document that belongs to the same vessel', async () => {
    prismaMock.vesselDocument.findFirst.mockResolvedValue(null);

    await expect(
      service.create('vessel-1', { reportDocumentId: 'doc-of-other' }, actor),
    ).rejects.toThrow('Report document not found for this vessel');
    expect(prismaMock.vesselDocument.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc-of-other', vesselId: 'vessel-1', deletedAt: null },
      select: { id: true },
    });
  });

  it('rejects an update that makes the expiry earlier than the survey date', async () => {
    prismaMock.vesselSurvey.findFirst.mockResolvedValue({
      id: 's-1',
      surveyDate: new Date('2026-06-01'),
      validUntil: null,
    });

    await expect(
      service.update(
        'vessel-1',
        's-1',
        { validUntil: new Date('2026-01-01') },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.vesselSurvey.update).not.toHaveBeenCalled();
  });

  it('soft deletes a survey', async () => {
    prismaMock.vesselSurvey.findFirst.mockResolvedValue({ id: 's-1' });

    await expect(service.delete('vessel-1', 's-1', actor)).resolves.toEqual({
      id: 's-1',
    });
    expect(prismaMock.vesselSurvey.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe('createVesselSurveySchema', () => {
  it('normalises the free-text status and checks the date order', () => {
    expect(
      createVesselSurveySchema.parse({ status: ' in progress ' }).status,
    ).toBe('IN_PROGRESS');
    expect(() =>
      createVesselSurveySchema.parse({
        surveyDate: '2026-06-01',
        validUntil: '2026-01-01',
      }),
    ).toThrow();
  });
});
