import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { VesselDocumentsService } from './vessel-documents.service';
import {
  createVesselDocumentSchema,
  updateVesselDocumentSchema,
} from './vessel-documents.validation';

describe('VesselDocumentsService', () => {
  let service: VesselDocumentsService;

  const prismaMock = {
    vessel: { findFirst: vi.fn() },
    vesselDocument: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const storageMock = { upload: vi.fn() };

  const actor = { id: 'user-1', fullname: 'User Test' };
  const vessel = { id: 'vessel-1', name: 'KAIROS JAYA' };
  const file = {
    originalname: 'surat-laut.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('x'),
  } as Express.Multer.File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VesselDocumentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();

    service = module.get(VesselDocumentsService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
  });

  describe('list', () => {
    it('rejects an unknown vessel', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(null);

      await expect(service.list('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('filters by category and hides deleted documents', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(vessel);
      prismaMock.vesselDocument.findMany.mockResolvedValue([]);

      await service.list('vessel-1', { category: 'PHOTO' });

      expect(prismaMock.vesselDocument.findMany).toHaveBeenCalledWith({
        where: { vesselId: 'vessel-1', deletedAt: null, category: 'PHOTO' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('uploads the file and stores the document with defaults', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(vessel);
      storageMock.upload.mockResolvedValue('https://s3/bucket/key.pdf');
      prismaMock.vesselDocument.create.mockResolvedValue({
        id: 'doc-1',
        category: 'OTHER',
        fileName: 'surat-laut.pdf',
      });

      await service.create('vessel-1', {}, file, actor);

      expect(storageMock.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^vessels\/vessel-1\/documents\/.+\.pdf$/),
        file.buffer,
        'application/pdf',
      );
      expect(prismaMock.vesselDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          vesselId: 'vessel-1',
          category: 'OTHER',
          status: 'AVAILABLE',
          fileName: 'surat-laut.pdf',
          fileUrl: 'https://s3/bucket/key.pdf',
          uploadedById: 'user-1',
        }),
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
    });

    it('does not upload when the vessel does not exist', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(null);

      await expect(service.create('missing', {}, file, actor)).rejects.toThrow(
        NotFoundException,
      );
      expect(storageMock.upload).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects a validity range that ends before it starts', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(vessel);
      prismaMock.vesselDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        fileName: 'a.pdf',
        validFrom: new Date('2026-06-01'),
        validUntil: null,
      });

      await expect(
        service.update(
          'vessel-1',
          'doc-1',
          { validUntil: new Date('2026-01-01') },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.vesselDocument.update).not.toHaveBeenCalled();
    });

    it('only changes the fields that were sent', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(vessel);
      prismaMock.vesselDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        fileName: 'a.pdf',
        validFrom: null,
        validUntil: null,
      });
      prismaMock.vesselDocument.update.mockResolvedValue({
        id: 'doc-1',
        fileName: 'a.pdf',
      });

      await service.update('vessel-1', 'doc-1', { status: 'EXPIRED' }, actor);

      expect(prismaMock.vesselDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { status: 'EXPIRED' },
      });
    });
  });

  describe('delete', () => {
    it('rejects a document that belongs to another vessel', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(vessel);
      prismaMock.vesselDocument.findFirst.mockResolvedValue(null);

      await expect(service.delete('vessel-1', 'doc-9', actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('soft deletes the document', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(vessel);
      prismaMock.vesselDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        fileName: 'a.pdf',
      });

      const result = await service.delete('vessel-1', 'doc-1', actor);

      expect(result).toEqual({ id: 'doc-1' });
      expect(prismaMock.vesselDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});

describe('vessel document schemas', () => {
  it('treats empty multipart fields as not sent', () => {
    const result = createVesselDocumentSchema.parse({
      category: '',
      title: '',
      validUntil: '',
    });

    expect(result.category).toBeUndefined();
    expect(result.title).toBeUndefined();
    expect(result.validUntil).toBeUndefined();
  });

  it('normalises free-text category to upper snake case', () => {
    const result = createVesselDocumentSchema.parse({
      category: ' surat laut ',
    });

    expect(result.category).toBe('SURAT_LAUT');
  });

  it('rejects validUntil earlier than validFrom', () => {
    expect(() =>
      createVesselDocumentSchema.parse({
        validFrom: '2026-06-01',
        validUntil: '2026-01-01',
      }),
    ).toThrow();
  });

  it('allows clearing optional fields on update with null', () => {
    const result = updateVesselDocumentSchema.parse({
      title: null,
      validUntil: null,
    });

    expect(result.title).toBeNull();
    expect(result.validUntil).toBeNull();
  });
});
