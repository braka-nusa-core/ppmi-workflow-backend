import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestInvoicesService } from './request-invoices.service';
import {
  returnRequestInvoiceSchema,
  uploadRequestInvoiceDocumentSchema,
} from './request-invoices.validation';

describe('request invoice schemas', () => {
  it('requires notes when returning', () => {
    expect(returnRequestInvoiceSchema.safeParse({}).success).toBe(false);
    expect(returnRequestInvoiceSchema.safeParse({ notes: ' ' }).success).toBe(
      false,
    );
    expect(
      returnRequestInvoiceSchema.safeParse({ notes: 'CN/DN salah' }).success,
    ).toBe(true);
  });

  it('validates the document type', () => {
    expect(
      uploadRequestInvoiceDocumentSchema.safeParse({ documentType: 'CN_DN' })
        .success,
    ).toBe(true);
    expect(
      uploadRequestInvoiceDocumentSchema.safeParse({ documentType: 'X' })
        .success,
    ).toBe(false);
    expect(uploadRequestInvoiceDocumentSchema.safeParse({}).success).toBe(
      false,
    );
  });
});

describe('RequestInvoicesService', () => {
  let service: RequestInvoicesService;

  const prismaMock = {
    policy: { findFirst: vi.fn() },
    requestInvoice: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    requestInvoiceDocument: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    requestInvoiceReview: { create: vi.fn() },
    organizationUnit: { findMany: vi.fn() },
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const storageMock = { upload: vi.fn() };
  const notificationsMock = { createMany: vi.fn() };

  const actor = { id: 'user-1', fullname: 'User Test' };
  const finance = { id: 'fin-1', fullname: 'Finance' };
  const file = {
    originalname: 'cndn.pdf',
    mimetype: 'application/pdf',
    size: 20,
    buffer: Buffer.from('x'),
  } as Express.Multer.File;

  const rfi = (overrides: Record<string, unknown> = {}) => ({
    id: 'rfi-1',
    requestNumber: 'RFI-20261123-001',
    status: 'DRAFT',
    submittedById: 'user-1',
    policy: {
      policyNumber: 'POL-1',
      quotation: { technicalUnitId: null },
    },
    ...overrides,
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RequestInvoicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();
    service = module.get(RequestInvoicesService);
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.requestInvoice.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('create', () => {
    const policy = {
      id: 'p-1',
      policyNumber: 'POL-1',
      status: 'PLACEMENT_COMPLETED',
      quotation: { technicalUnitId: null },
    };

    it('requires completed placement', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({
        ...policy,
        status: 'POLICY_ISSUED',
      });
      await expect(service.create('p-1', {}, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unknown policy', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(null);
      await expect(service.create('p-1', {}, actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows only one active RFI per policy', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(policy);
      prismaMock.requestInvoice.findFirst.mockResolvedValueOnce({ id: 'x' });
      await expect(service.create('p-1', {}, actor)).rejects.toThrow(
        'Policy already has a request for invoice',
      );
    });

    it('rejects an actor from another technical unit', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({
        ...policy,
        quotation: { technicalUnitId: 'unit-hm' },
      });
      prismaMock.user.findFirst.mockResolvedValue({
        role: 'USER',
        organizationUnitId: 'unit-cargo',
      });
      await expect(service.create('p-1', {}, actor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('creates a DRAFT with the next number of the day', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(policy);
      prismaMock.requestInvoice.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ requestNumber: 'RFI-20261123-004' });
      prismaMock.requestInvoice.create.mockResolvedValue({
        id: 'rfi-1',
        requestNumber: 'x',
      });

      await service.create('p-1', { notes: 'n' }, actor);

      const data = prismaMock.requestInvoice.create.mock.calls[0][0].data;
      expect(data.requestNumber).toMatch(/^RFI-\d{8}-005$/);
      expect(data).toMatchObject({
        policyId: 'p-1',
        status: 'DRAFT',
        notes: 'n',
      });
      expect(prismaMock.log.create.mock.calls[0][0].data.referenceType).toBe(
        'REQUEST_FOR_INVOICE',
      );
    });
  });

  describe('get', () => {
    it('builds the checklist from the uploaded documents', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue({
        ...rfi(),
        documents: [
          { documentType: 'POLICY_DOCUMENT' },
          { documentType: 'OTHER' },
        ],
        reviews: [],
      });

      const result = await service.get('rfi-1');

      expect(result.checklist).toEqual([
        { documentType: 'POLICY_DOCUMENT', required: true, uploaded: true },
        { documentType: 'SIGNED_QS', required: true, uploaded: false },
        { documentType: 'CN_DN', required: true, uploaded: false },
        {
          documentType: 'RENEWAL_ATTACHMENT',
          required: false,
          uploaded: false,
        },
        { documentType: 'OTHER', required: false, uploaded: true },
      ]);
    });
  });

  describe('update and documents', () => {
    it.each(['RFI_SUBMITTED', 'READY_FOR_INVOICE'])(
      'refuses edits in %s',
      async (status) => {
        prismaMock.requestInvoice.findFirst.mockResolvedValue(rfi({ status }));

        await expect(
          service.update('rfi-1', { notes: 'x' }, actor),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.addDocument('rfi-1', { documentType: 'CN_DN' }, file, actor),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.deleteDocument('rfi-1', 'd-1', actor),
        ).rejects.toThrow(BadRequestException);
        expect(storageMock.upload).not.toHaveBeenCalled();
      },
    );

    it('allows edits when returned to technical', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(
        rfi({ status: 'RETURNED_TO_TECHNICAL' }),
      );
      await service.update('rfi-1', { notes: 'x' }, actor);
      expect(
        prismaMock.requestInvoice.updateMany.mock.calls[0][0].where,
      ).toMatchObject({ status: 'RETURNED_TO_TECHNICAL' });
    });

    it('uploads a document under request-invoices/{id}/', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(rfi());
      storageMock.upload.mockResolvedValue('https://s3/cndn.pdf');
      prismaMock.requestInvoiceDocument.create.mockResolvedValue({});

      await service.addDocument(
        'rfi-1',
        { documentType: 'CN_DN' },
        file,
        actor,
      );

      expect(storageMock.upload.mock.calls[0][0]).toMatch(
        /^request-invoices\/rfi-1\/[0-9a-f-]+\.pdf$/,
      );
      expect(
        prismaMock.requestInvoiceDocument.create.mock.calls[0][0].data,
      ).toMatchObject({
        requestInvoiceId: 'rfi-1',
        documentType: 'CN_DN',
        fileName: 'cndn.pdf',
        url: 'https://s3/cndn.pdf',
        mimeType: 'application/pdf',
        fileSize: 20,
        uploadedById: 'user-1',
      });
    });

    it('soft deletes a document', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(rfi());
      prismaMock.requestInvoiceDocument.findFirst.mockResolvedValue({
        id: 'd-1',
        fileName: 'cndn.pdf',
      });

      await service.deleteDocument('rfi-1', 'd-1', actor);

      expect(
        prismaMock.requestInvoiceDocument.update.mock.calls[0][0].data
          .deletedAt,
      ).toBeInstanceOf(Date);
    });

    it('rejects an actor from another technical unit', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(
        rfi({
          policy: {
            policyNumber: 'POL-1',
            quotation: { technicalUnitId: 'unit-hm' },
          },
        }),
      );
      prismaMock.user.findFirst.mockResolvedValue({
        role: 'USER',
        organizationUnitId: 'unit-cargo',
      });
      await expect(
        service.update('rfi-1', { notes: 'x' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submit', () => {
    const allDocuments = [
      { documentType: 'POLICY_DOCUMENT' },
      { documentType: 'SIGNED_QS' },
      { documentType: 'CN_DN' },
    ];

    beforeEach(() => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(rfi());
      prismaMock.requestInvoiceDocument.findMany.mockResolvedValue(
        allDocuments,
      );
      prismaMock.organizationUnit.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'fin-1' },
        { id: 'fin-2' },
      ]);
      notificationsMock.createMany.mockResolvedValue(2);
    });

    it('rejects when a required document is missing', async () => {
      prismaMock.requestInvoiceDocument.findMany.mockResolvedValue([
        { documentType: 'POLICY_DOCUMENT' },
        { documentType: 'OTHER' },
      ]);

      await expect(service.submit('rfi-1', actor)).rejects.toThrow(
        'Missing required documents: SIGNED_QS, CN_DN',
      );
      expect(prismaMock.requestInvoice.updateMany).not.toHaveBeenCalled();
      expect(notificationsMock.createMany).not.toHaveBeenCalled();
    });

    it('rejects a request that is already submitted', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(
        rfi({ status: 'RFI_SUBMITTED' }),
      );
      await expect(service.submit('rfi-1', actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('submits guarded by the previous status and notifies finance', async () => {
      await service.submit('rfi-1', actor);

      const call = prismaMock.requestInvoice.updateMany.mock.calls[0][0];
      expect(call.where.status).toBe('DRAFT');
      expect(call.data).toMatchObject({
        status: 'RFI_SUBMITTED',
        submittedById: 'user-1',
      });
      expect(call.data.submittedAt).toBeInstanceOf(Date);

      const sent = notificationsMock.createMany.mock.calls[0][0];
      expect(sent).toHaveLength(2);
      expect(sent[0]).toMatchObject({
        recipientId: 'fin-1',
        type: 'RFI_SUBMITTED',
        referenceType: 'REQUEST_FOR_INVOICE',
        referenceId: 'rfi-1',
      });
      expect(sent[0].dedupeKey).toBe(
        `RFI_SUBMITTED:rfi-1:${call.data.submittedAt.toISOString()}:fin-1`,
      );
    });

    it('can be submitted again after a return', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(
        rfi({ status: 'RETURNED_TO_TECHNICAL' }),
      );
      await service.submit('rfi-1', actor);
      expect(
        prismaMock.requestInvoice.updateMany.mock.calls[0][0].where.status,
      ).toBe('RETURNED_TO_TECHNICAL');
    });

    it('still succeeds when the notification fails', async () => {
      notificationsMock.createMany.mockRejectedValue(new Error('db down'));
      await expect(service.submit('rfi-1', actor)).resolves.not.toThrow();
      expect(prismaMock.requestInvoice.updateMany).toHaveBeenCalled();
    });

    it('fails on a concurrent status change', async () => {
      prismaMock.requestInvoice.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.submit('rfi-1', actor)).rejects.toThrow(
        'changed concurrently',
      );
      expect(notificationsMock.createMany).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('only reviews a submitted RFI', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(rfi());
      await expect(service.approve('rfi-1', {}, finance)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('moves to READY_FOR_INVOICE and records the review', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(
        rfi({ status: 'RFI_SUBMITTED' }),
      );

      await service.approve('rfi-1', { notes: 'ok' }, finance);

      expect(
        prismaMock.requestInvoice.updateMany.mock.calls[0][0],
      ).toMatchObject({
        where: { status: 'RFI_SUBMITTED' },
        data: { status: 'READY_FOR_INVOICE' },
      });
      expect(
        prismaMock.requestInvoiceReview.create.mock.calls[0][0].data,
      ).toMatchObject({
        reviewerId: 'fin-1',
        action: 'APPROVED',
        notes: 'ok',
      });
    });
  });

  describe('return', () => {
    beforeEach(() => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(
        rfi({ status: 'RFI_SUBMITTED' }),
      );
      prismaMock.requestInvoiceReview.create.mockResolvedValue({ id: 'rv-1' });
    });

    it('returns to technical and notifies the submitter', async () => {
      await service.return('rfi-1', { notes: 'CN/DN salah' }, finance);

      expect(
        prismaMock.requestInvoice.updateMany.mock.calls[0][0],
      ).toMatchObject({
        where: { status: 'RFI_SUBMITTED' },
        data: { status: 'RETURNED_TO_TECHNICAL' },
      });
      expect(
        prismaMock.requestInvoiceReview.create.mock.calls[0][0].data,
      ).toMatchObject({ action: 'RETURNED', notes: 'CN/DN salah' });
      expect(notificationsMock.createMany.mock.calls[0][0][0]).toMatchObject({
        recipientId: 'user-1',
        type: 'RFI_RETURNED',
        referenceType: 'REQUEST_FOR_INVOICE',
        referenceId: 'rfi-1',
      });
    });

    it('still succeeds when the notification fails', async () => {
      notificationsMock.createMany.mockRejectedValue(new Error('boom'));
      await expect(
        service.return('rfi-1', { notes: 'x' }, finance),
      ).resolves.not.toThrow();
    });
  });

  describe('delete', () => {
    it('only deletes a DRAFT', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(
        rfi({ status: 'RETURNED_TO_TECHNICAL' }),
      );
      await expect(service.delete('rfi-1', actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('soft deletes a DRAFT guarded by status', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(rfi());

      await expect(service.delete('rfi-1', actor)).resolves.toEqual({
        id: 'rfi-1',
      });

      const call = prismaMock.requestInvoice.updateMany.mock.calls[0][0];
      expect(call.where.status).toBe('DRAFT');
      expect(call.data.deletedAt).toBeInstanceOf(Date);
    });
  });
});
