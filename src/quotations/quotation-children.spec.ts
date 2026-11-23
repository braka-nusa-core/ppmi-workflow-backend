import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotationAttachmentsService } from './quotation-attachments.service';
import { QuotationCoveragesService } from './quotation-coverages.service';
import { QuotationObjectsService } from './quotation-objects.service';
import { QuotationReferencesService } from './quotation-references.service';
import { QuotationTermsService } from './quotation-terms.service';
import { QuotationWarrantiesService } from './quotation-warranties.service';

const model = () => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
});

const prismaMock = {
  quotationObject: model(),
  quotationCoverage: model(),
  quotationTerm: model(),
  quotationWarranty: model(),
  quotationAttachment: model(),
  vessel: { findFirst: vi.fn() },
  adjuster: { findMany: vi.fn() },
  surveyor: { findMany: vi.fn() },
  qsTemplate: { findFirst: vi.fn() },
};
const quotationsMock = {
  assertEditable: vi.fn(),
  markInsurerRevisionUpdated: vi.fn(),
};
const storageMock = { upload: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  quotationsMock.assertEditable.mockResolvedValue({ id: 'q-1' });
  quotationsMock.markInsurerRevisionUpdated.mockResolvedValue(undefined);
});

// The coverages, warranties, terms, and objects services share one contract:
// every write needs an editable quotation, marks an insurer-revision fix, and
// deletes softly. The table below checks that for each of them.
const cases = [
  {
    name: 'objects',
    build: () =>
      new QuotationObjectsService(prismaMock as any, quotationsMock as any),
    model: prismaMock.quotationObject,
    notFound: 'Quotation object not found',
    createDto: { objectType: 'VESSEL', data: { name: 'KAIROS' } },
    updateDto: { objectType: 'CARGO' },
  },
  {
    name: 'coverages',
    build: () =>
      new QuotationCoveragesService(prismaMock as any, quotationsMock as any),
    model: prismaMock.quotationCoverage,
    notFound: 'Quotation coverage not found',
    createDto: { coverageType: 'HULL', description: 'Hull', value: 100 },
    updateDto: { description: 'Changed' },
  },
  {
    name: 'terms',
    build: () =>
      new QuotationTermsService(prismaMock as any, quotationsMock as any),
    model: prismaMock.quotationTerm,
    notFound: 'Quotation term not found',
    createDto: { description: 'Clause', section: 'TERMS_CONDITIONS' },
    updateDto: { isSelected: false },
  },
  {
    name: 'warranties',
    build: () =>
      new QuotationWarrantiesService(prismaMock as any, quotationsMock as any),
    model: prismaMock.quotationWarranty,
    notFound: 'Quotation warranty not found',
    createDto: { warrantyId: 'w-1', description: 'Warranty' },
    updateDto: { sortOrder: 2 },
  },
];

describe.each(cases)('quotation $name', (c) => {
  let service: any;

  beforeEach(() => {
    service = c.build();
  });

  it('lists only active rows of the quotation', async () => {
    c.model.findMany.mockResolvedValue([]);

    await service.list('q-1');

    expect(c.model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { quotationId: 'q-1', deletedAt: null },
      }),
    );
  });

  it('rejects a row that belongs to another quotation or was deleted', async () => {
    c.model.findFirst.mockResolvedValue(null);

    await expect(service.get('q-1', 'x')).rejects.toThrow(c.notFound);
    expect(c.model.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'x', quotationId: 'q-1', deletedAt: null },
      }),
    );
  });

  it('checks the quotation is editable before writing, and marks the revision fix', async () => {
    c.model.create.mockResolvedValue({ id: 'new' });

    await service.create('q-1', c.createDto, 'user-1');

    expect(quotationsMock.assertEditable).toHaveBeenCalledWith('q-1', 'user-1');
    expect(c.model.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quotationId: 'q-1' }),
    });
    expect(quotationsMock.markInsurerRevisionUpdated).toHaveBeenCalledWith(
      'q-1',
    );
  });

  it('does not write when the quotation is not editable', async () => {
    quotationsMock.assertEditable.mockRejectedValue(
      new BadRequestException('Can only edit quotation in DRAFT or REVISION'),
    );

    await expect(service.create('q-1', c.createDto, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.update('q-1', 'x', c.updateDto, 'user-1'),
    ).rejects.toThrow(BadRequestException);
    await expect(service.delete('q-1', 'x', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(c.model.create).not.toHaveBeenCalled();
    expect(c.model.update).not.toHaveBeenCalled();
  });

  it('rejects updating or deleting a row that does not exist', async () => {
    c.model.findFirst.mockResolvedValue(null);

    await expect(
      service.update('q-1', 'x', c.updateDto, 'user-1'),
    ).rejects.toThrow(c.notFound);
    await expect(service.delete('q-1', 'x', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(c.model.update).not.toHaveBeenCalled();
  });

  it('updates the row and marks the revision fix', async () => {
    c.model.findFirst.mockResolvedValue({ id: 'x' });
    c.model.update.mockResolvedValue({ id: 'x' });

    await service.update('q-1', 'x', c.updateDto, 'user-1');

    expect(c.model.update).toHaveBeenCalledWith({
      where: { id: 'x' },
      data: expect.objectContaining(c.updateDto),
    });
    expect(quotationsMock.markInsurerRevisionUpdated).toHaveBeenCalledWith(
      'q-1',
    );
  });

  it('deletes softly and returns the id', async () => {
    c.model.findFirst.mockResolvedValue({ id: 'x' });

    await expect(service.delete('q-1', 'x', 'user-1')).resolves.toEqual({
      id: 'x',
    });
    expect(c.model.update).toHaveBeenCalledWith({
      where: { id: 'x' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(quotationsMock.markInsurerRevisionUpdated).toHaveBeenCalledWith(
      'q-1',
    );
  });
});

describe('quotation objects linked to the vessel master', () => {
  const master = {
    id: 'vessel-1',
    name: 'BUANA HARBOUR 3201',
    imoNumber: '9876543',
    vesselType: 'HARBOUR TUG',
    builtYear: 2018,
    grossTonnage: 354,
    vesselClass: 'BKI',
    classNotApplicable: false,
    flag: 'Indonesia',
    tradingArea: null,
    portOfRegistry: 'Jakarta',
  };
  let service: QuotationObjectsService;

  beforeEach(() => {
    service = new QuotationObjectsService(
      prismaMock as any,
      quotationsMock as any,
    );
    prismaMock.quotationObject.create.mockResolvedValue({ id: 'o-1' });
  });

  it('starts the object from the master and leaves out blank fields', async () => {
    prismaMock.vessel.findFirst.mockResolvedValue(master);

    await service.create(
      'q-1',
      { objectType: 'VESSEL', vesselId: 'vessel-1' },
      'user-1',
    );

    const data = prismaMock.quotationObject.create.mock.calls[0][0].data;
    expect(data.vesselId).toBe('vessel-1');
    expect(data.data).toEqual({
      name: 'BUANA HARBOUR 3201',
      imoNumber: '9876543',
      vesselType: 'HARBOUR TUG',
      builtYear: 2018,
      grossTonnage: 354,
      vesselClass: 'BKI',
      classNotApplicable: false,
      flag: 'Indonesia',
      portOfRegistry: 'Jakarta',
    });
    expect('tradingArea' in data.data).toBe(false);
  });

  it('lets values sent in data win over the master', async () => {
    prismaMock.vessel.findFirst.mockResolvedValue(master);

    await service.create(
      'q-1',
      {
        objectType: 'VESSEL',
        vesselId: 'vessel-1',
        data: { flag: 'Singapore', note: 'extra' },
      },
      'user-1',
    );

    const stored = prismaMock.quotationObject.create.mock.calls[0][0].data.data;
    expect(stored).toMatchObject({
      flag: 'Singapore',
      note: 'extra',
      name: 'BUANA HARBOUR 3201',
    });
  });

  it('keeps data as sent when it is not an object', async () => {
    prismaMock.vessel.findFirst.mockResolvedValue(master);

    await service.create(
      'q-1',
      { objectType: 'VESSEL', vesselId: 'vessel-1', data: 'free text' },
      'user-1',
    );

    expect(prismaMock.quotationObject.create.mock.calls[0][0].data.data).toBe(
      'free text',
    );
  });

  it('rejects an unknown or deleted vessel without writing', async () => {
    prismaMock.vessel.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        'q-1',
        { objectType: 'VESSEL', vesselId: 'missing' },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.vessel.findFirst).toHaveBeenCalledWith({
      where: { id: 'missing', deletedAt: null },
    });
    expect(prismaMock.quotationObject.create).not.toHaveBeenCalled();
  });

  it('does not touch the vessel table without a vesselId', async () => {
    await service.create(
      'q-1',
      { objectType: 'CARGO', data: { weight: 10 } },
      'user-1',
    );

    expect(prismaMock.vessel.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.quotationObject.create.mock.calls[0][0].data).toEqual({
      quotationId: 'q-1',
      objectType: 'CARGO',
      vesselId: undefined,
      data: { weight: 10 },
    });
  });

  it('never rewrites the snapshot when the link is changed or removed', async () => {
    prismaMock.quotationObject.findFirst.mockResolvedValue({ id: 'o-1' });
    prismaMock.quotationObject.update.mockResolvedValue({ id: 'o-1' });

    await service.update('q-1', 'o-1', { vesselId: null }, 'user-1');

    expect(prismaMock.quotationObject.update).toHaveBeenCalledWith({
      where: { id: 'o-1' },
      data: { vesselId: null },
    });
  });

  it('checks the vessel when an object is relinked', async () => {
    prismaMock.quotationObject.findFirst.mockResolvedValue({ id: 'o-1' });
    prismaMock.vessel.findFirst.mockResolvedValue(null);

    await expect(
      service.update('q-1', 'o-1', { vesselId: 'missing' }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.quotationObject.update).not.toHaveBeenCalled();
  });
});

describe('quotation terms specifics', () => {
  it('passes the selection flags and condition rule through on create', async () => {
    const service = new QuotationTermsService(
      prismaMock as any,
      quotationsMock as any,
    );
    prismaMock.quotationTerm.create.mockResolvedValue({ id: 't-1' });

    await service.create(
      'q-1',
      {
        termsConditionId: 'tc-1',
        isSelected: true,
        isEditable: false,
        isRemovable: false,
        selectionGroup: 'ITC',
        conditionRule: { maxAge: 25 },
      } as any,
      'user-1',
    );

    expect(prismaMock.quotationTerm.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        termsConditionId: 'tc-1',
        selectionGroup: 'ITC',
        isEditable: false,
        conditionRule: { maxAge: 25 },
      }),
    });
  });

  it('lists terms in display order with their catalogue entry', async () => {
    const service = new QuotationTermsService(
      prismaMock as any,
      quotationsMock as any,
    );
    prismaMock.quotationTerm.findMany.mockResolvedValue([]);

    await service.list('q-1');

    expect(prismaMock.quotationTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { termsCondition: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  });
});

describe('quotation attachments', () => {
  let service: QuotationAttachmentsService;
  const file = {
    originalname: 'slip.pdf',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('x'),
  } as Express.Multer.File;

  beforeEach(() => {
    service = new QuotationAttachmentsService(
      prismaMock as any,
      storageMock as any,
      quotationsMock as any,
    );
  });

  it('uploads to a quotation-scoped key and stores the file details', async () => {
    storageMock.upload.mockResolvedValue('https://s3/bucket/key.pdf');
    prismaMock.quotationAttachment.create.mockResolvedValue({ id: 'a-1' });

    await service.create('q-1', file, 'user-1');

    expect(storageMock.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^quotations\/q-1\/.+\.pdf$/),
      file.buffer,
      'application/pdf',
    );
    expect(prismaMock.quotationAttachment.create).toHaveBeenCalledWith({
      data: {
        quotationId: 'q-1',
        fileName: 'slip.pdf',
        url: 'https://s3/bucket/key.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
      },
    });
    expect(quotationsMock.markInsurerRevisionUpdated).toHaveBeenCalledWith(
      'q-1',
    );
  });

  it('does not upload when the quotation is not editable', async () => {
    quotationsMock.assertEditable.mockRejectedValue(
      new BadRequestException('Can only edit quotation in DRAFT or REVISION'),
    );

    await expect(service.create('q-1', file, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it('re-checks editability after the upload, in case the status changed meanwhile', async () => {
    storageMock.upload.mockResolvedValue('https://s3/bucket/key.pdf');
    prismaMock.quotationAttachment.create.mockResolvedValue({ id: 'a-1' });

    await service.create('q-1', file, 'user-1');

    expect(quotationsMock.assertEditable).toHaveBeenCalledTimes(2);
  });

  it('deletes softly', async () => {
    prismaMock.quotationAttachment.findFirst.mockResolvedValue({ id: 'a-1' });

    await expect(service.delete('q-1', 'a-1', 'user-1')).resolves.toEqual({
      id: 'a-1',
    });
    expect(prismaMock.quotationAttachment.update).toHaveBeenCalledWith({
      where: { id: 'a-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('rejects an unknown attachment', async () => {
    prismaMock.quotationAttachment.findFirst.mockResolvedValue(null);

    await expect(service.get('q-1', 'x')).rejects.toThrow(
      'Quotation attachment not found',
    );
  });
});

describe('quotation references', () => {
  let service: QuotationReferencesService;

  beforeEach(() => {
    service = new QuotationReferencesService(prismaMock as any);
  });

  it('lists active adjusters and surveyors by name', async () => {
    prismaMock.adjuster.findMany.mockResolvedValue([]);
    prismaMock.surveyor.findMany.mockResolvedValue([]);

    await service.listAdjusters();
    await service.listSurveyors();

    expect(prismaMock.adjuster.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    expect(prismaMock.surveyor.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  });

  it('returns the newest template of a domain, or reports none', async () => {
    prismaMock.qsTemplate.findFirst.mockResolvedValueOnce({ id: 't-1' });
    await expect(service.getTemplate('CARGO')).resolves.toEqual({ id: 't-1' });
    expect(prismaMock.qsTemplate.findFirst).toHaveBeenCalledWith({
      where: { templateDomain: 'CARGO', deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });

    prismaMock.qsTemplate.findFirst.mockResolvedValueOnce(null);
    await expect(service.getTemplate('HULL_MACHINERY')).rejects.toThrow(
      'Quotation template not found',
    );
  });
});
