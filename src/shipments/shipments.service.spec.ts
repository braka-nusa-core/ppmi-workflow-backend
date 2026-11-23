import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { ShipmentsService } from './shipments.service';

describe('ShipmentsService', () => {
  let service: ShipmentsService;

  const prismaMock = {
    shipment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    shipmentDocument: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoice: { findFirst: vi.fn() },
    policyParticipant: { findMany: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const storageMock = { upload: vi.fn() };
  const actor = { id: 'user-1', fullname: 'Finance User' };

  const deliveredShipment = (invoiceStatus = 'PAID') => ({
    id: 'ship-1',
    status: 'DELIVERED',
    invoice: {
      invoiceNumber: 'INV-1',
      status: invoiceStatus,
      requestInvoice: { policy: { id: 'pol-1', quotationId: 'q-1' } },
    },
  });
  const participant = (name: string, status?: string) => ({
    insuranceCompany: { name },
    outgoingPayments: status ? [{ status }] : [],
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();
    service = module.get(ShipmentsService);

    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
  });

  describe('create', () => {
    it('rejects an unknown invoice', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue(null);
      await expect(service.create('x', {}, actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates the shipment as SHIPPED and logs it', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-1',
      });
      prismaMock.shipment.create.mockResolvedValue({ id: 'ship-1' });

      await service.create(
        'inv-1',
        { courier: 'JNE', trackingNumber: 'R1' },
        actor,
      );

      expect(prismaMock.shipment.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ status: 'SHIPPED', trackingNumber: 'R1' }),
      );
      expect(prismaMock.log.create.mock.calls[0][0].data.referenceType).toBe(
        'SHIPMENT',
      );
    });
  });

  describe('list', () => {
    it('filters by status and invoice and hides deleted rows', async () => {
      prismaMock.shipment.findMany.mockResolvedValue([]);
      prismaMock.shipment.count.mockResolvedValue(0);

      await service.list({
        status: 'SHIPPED',
        invoiceId: 'inv-1',
        page: 2,
        limit: 10,
      });

      expect(prismaMock.shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, status: 'SHIPPED', invoiceId: 'inv-1' },
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  describe('update', () => {
    it('refuses to change a completed shipment', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'ship-1',
        status: 'COMPLETED',
      });
      await expect(
        service.update('ship-1', { notes: 'x' }, actor),
      ).rejects.toThrow('completed');
    });
  });

  describe('deliver', () => {
    const dto = { receivedDate: new Date('2026-11-25'), receiver: 'Budi' };

    it('only delivers a SHIPPED shipment', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'ship-1',
        status: 'DELIVERED',
      });
      await expect(service.deliver('ship-1', dto, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('moves SHIPPED to DELIVERED guarded by the previous status', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'ship-1',
        status: 'SHIPPED',
      });
      prismaMock.shipment.updateMany.mockResolvedValue({ count: 1 });

      await service.deliver('ship-1', dto, actor);

      expect(prismaMock.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'ship-1', status: 'SHIPPED', deletedAt: null },
        data: {
          status: 'DELIVERED',
          receivedDate: dto.receivedDate,
          receiver: 'Budi',
        },
      });
    });

    it('fails when another request changed the status first', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'ship-1',
        status: 'SHIPPED',
      });
      prismaMock.shipment.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.deliver('ship-1', dto, actor)).rejects.toThrow(
        'status changed',
      );
    });
  });

  describe('complete', () => {
    it('requires DELIVERED', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        ...deliveredShipment(),
        status: 'SHIPPED',
      });
      await expect(service.complete('ship-1', actor)).rejects.toThrow(
        'delivered shipment',
      );
    });

    it('rejects an unpaid invoice', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue(
        deliveredShipment('PARTIALLY_PAID'),
      );
      prismaMock.policyParticipant.findMany.mockResolvedValue([
        participant('Insurer A', 'FULLY_PAID'),
      ]);
      await expect(service.complete('ship-1', actor)).rejects.toThrow(
        'invoice is not paid',
      );
      expect(prismaMock.shipment.updateMany).not.toHaveBeenCalled();
    });

    it('names companies without an outgoing payment or not fully paid', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue(deliveredShipment());
      prismaMock.policyParticipant.findMany.mockResolvedValue([
        participant('Insurer A', 'FULLY_PAID'),
        participant('Insurer B'),
        participant('Insurer C', 'PARTIAL_PAYMENT'),
      ]);

      const error = await service
        .complete('ship-1', actor)
        .catch((e: BadRequestException) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toContain(
        'no outgoing payment for Insurer B',
      );
      expect((error as BadRequestException).message).toContain(
        'not fully paid for Insurer C',
      );
      expect((error as BadRequestException).message).not.toContain('Insurer A');
    });

    it('rejects a policy without placement participants', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue(deliveredShipment());
      prismaMock.policyParticipant.findMany.mockResolvedValue([]);
      await expect(service.complete('ship-1', actor)).rejects.toThrow(
        'no placement participants',
      );
    });

    it('only looks at non-deleted participants and payments of the quotation', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue(deliveredShipment());
      prismaMock.policyParticipant.findMany.mockResolvedValue([
        participant('A', 'FULLY_PAID'),
      ]);
      prismaMock.shipment.updateMany.mockResolvedValue({ count: 1 });

      await service.complete('ship-1', actor);

      expect(prismaMock.policyParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { quotationId: 'q-1', deletedAt: null },
          include: expect.objectContaining({
            outgoingPayments: { where: { deletedAt: null } },
          }),
        }),
      );
    });

    it('completes when the invoice is PAID and everyone is FULLY_PAID', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue(deliveredShipment());
      prismaMock.policyParticipant.findMany.mockResolvedValue([
        participant('A', 'FULLY_PAID'),
        participant('B', 'FULLY_PAID'),
      ]);
      prismaMock.shipment.updateMany.mockResolvedValue({ count: 1 });

      await service.complete('ship-1', actor);

      expect(prismaMock.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'ship-1', status: 'DELIVERED', deletedAt: null },
        data: { status: 'COMPLETED' },
      });
    });
  });

  describe('documents', () => {
    const file = {
      originalname: 'resi.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('x'),
    } as Express.Multer.File;

    it('uploads under shipments/{id}/', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'ship-1',
        status: 'SHIPPED',
      });
      storageMock.upload.mockResolvedValue('https://s3/resi.pdf');
      prismaMock.shipmentDocument.create.mockResolvedValue({ id: 'd1' });

      await service.addDocument(
        'ship-1',
        { documentType: 'RESI' },
        file,
        actor,
      );

      expect(storageMock.upload.mock.calls[0][0]).toMatch(
        /^shipments\/ship-1\/.+\.pdf$/,
      );
      expect(prismaMock.shipmentDocument.create.mock.calls[0][0].data).toEqual({
        shipmentId: 'ship-1',
        documentType: 'RESI',
        fileName: 'resi.pdf',
        url: 'https://s3/resi.pdf',
      });
    });

    it('soft deletes a document of the shipment', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'ship-1',
        status: 'SHIPPED',
      });
      prismaMock.shipmentDocument.findFirst.mockResolvedValue({
        id: 'd1',
        fileName: 'resi.pdf',
      });

      await service.deleteDocument('ship-1', 'd1', actor);

      expect(
        prismaMock.shipmentDocument.update.mock.calls[0][0].data.deletedAt,
      ).toBeInstanceOf(Date);
    });

    it('rejects an unknown document', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'ship-1',
        status: 'SHIPPED',
      });
      prismaMock.shipmentDocument.findFirst.mockResolvedValue(null);
      await expect(
        service.deleteDocument('ship-1', 'nope', actor),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
