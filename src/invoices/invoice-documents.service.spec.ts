import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { InvoiceDocumentsService } from './invoice-documents.service';
import { createInvoiceDocumentSchema } from './invoices.validation';

describe('InvoiceDocumentsService', () => {
  let service: InvoiceDocumentsService;
  const prismaMock = {
    invoice: { findFirst: vi.fn() },
    invoiceDocument: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const storageMock = { upload: vi.fn() };
  const actor = { id: 'user-1', fullname: 'Julia' };
  const file = {
    originalname: 'invoice.pdf',
    mimetype: 'application/pdf',
    size: 10,
    buffer: Buffer.from('x'),
  } as Express.Multer.File;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvoiceDocumentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();
    service = module.get(InvoiceDocumentsService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: '001/07-26/PPMI/FIN/MC',
    });
  });

  it('uploads under invoices/{id}/ and stores the document', async () => {
    storageMock.upload.mockResolvedValue('https://s3/b/key.pdf');
    prismaMock.invoiceDocument.create.mockResolvedValue({ id: 'doc-1' });

    await service.create('inv-1', { documentType: 'INVOICE_PDF' }, file, actor);

    expect(storageMock.upload.mock.calls[0][0]).toMatch(
      /^invoices\/inv-1\/[0-9a-f-]{36}\.pdf$/,
    );
    expect(prismaMock.invoiceDocument.create).toHaveBeenCalledWith({
      data: {
        invoiceId: 'inv-1',
        documentType: 'INVOICE_PDF',
        fileName: 'invoice.pdf',
        url: 'https://s3/b/key.pdf',
      },
    });
    expect(prismaMock.log.create.mock.calls[0][0].data.referenceType).toBe(
      'INVOICE',
    );
  });

  it('rejects an unknown invoice before uploading', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    await expect(
      service.create('x', { documentType: 'VOUCHER' }, file, actor),
    ).rejects.toThrow(NotFoundException);
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it('soft deletes a document', async () => {
    prismaMock.invoiceDocument.findFirst.mockResolvedValue({
      id: 'doc-1',
      documentType: 'VOUCHER',
      fileName: 'v.pdf',
    });
    await service.delete('inv-1', 'doc-1', actor);
    expect(
      prismaMock.invoiceDocument.update.mock.calls[0][0].data.deletedAt,
    ).toBeInstanceOf(Date);
  });

  it('404s on a missing document', async () => {
    prismaMock.invoiceDocument.findFirst.mockResolvedValue(null);
    await expect(service.delete('inv-1', 'x', actor)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('only accepts INVOICE_PDF and VOUCHER', () => {
    expect(
      createInvoiceDocumentSchema.safeParse({ documentType: 'OTHER' }).success,
    ).toBe(false);
  });
});
