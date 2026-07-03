import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { ShipmentsService } from './shipments.service';

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  const prismaMock = {
    documentShipment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    fileAttachment: {
      findFirst: vi.fn(),
    },
    log: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const createBody = {
    invoice_id: 'inv-1',
    courier: 'JNE',
    tracking_number: 'TRK-001',
    shipping_date: '2026-06-10T12:00:00.000Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (payload: any) => {
      if (Array.isArray(payload)) {
        return Promise.all(payload);
      }
      return payload(prismaMock);
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists shipments with filters, pagination, and sorting', async () => {
    prismaMock.documentShipment.findMany.mockResolvedValue([
      { id: 'ship-1', tracking_number: 'TRK-001' },
    ]);
    prismaMock.documentShipment.count.mockResolvedValue(11);

    const result = await service.listShipments({
      invoice_id: 'inv-1',
      search: 'TRK',
      page: '2',
      limit: '5',
      sort_by: 'created_at',
      sort_order: 'asc',
    });

    expect(prismaMock.documentShipment.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { deleted_at: null },
          { invoice_id: 'inv-1' },
          {
            OR: [
              { courier: { contains: 'TRK', mode: 'insensitive' } },
              { tracking_number: { contains: 'TRK', mode: 'insensitive' } },
            ],
          },
        ],
      },
      orderBy: { created_at: 'asc' },
      skip: 5,
      take: 5,
      include: {
        invoice: {
          select: {
            id: true,
            invoice_number: true,
          },
        },
        shipping_proof: {
          select: {
            id: true,
            file_name: true,
            file_url: true,
          },
        },
      },
    });
    expect(result).toEqual({
      items: [{ id: 'ship-1', tracking_number: 'TRK-001' }],
      total_pages: 3,
      current_page: 2,
    });
  });

  it('gets shipment detail when found', async () => {
    prismaMock.documentShipment.findFirst.mockResolvedValue({
      id: 'ship-1',
      tracking_number: 'TRK-001',
    });

    const result = await service.getShipment('ship-1');

    expect(prismaMock.documentShipment.findFirst).toHaveBeenCalledWith({
      where: { id: 'ship-1', deleted_at: null },
      include: {
        invoice: {
          select: {
            id: true,
            invoice_number: true,
          },
        },
        shipping_proof: {
          select: {
            id: true,
            file_name: true,
            file_url: true,
          },
        },
      },
    });
    expect(result).toEqual({ id: 'ship-1', tracking_number: 'TRK-001' });
  });

  it('rejects get when shipment missing', async () => {
    prismaMock.documentShipment.findFirst.mockResolvedValue(null);

    await expect(service.getShipment('ship-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates shipment and writes log when valid', async () => {
    prismaMock.documentShipment.findFirst.mockResolvedValue(null);
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });
    prismaMock.documentShipment.create.mockResolvedValue({ id: 'ship-1' });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });
    prismaMock.invoice.update.mockResolvedValue({ id: 'inv-1' });

    const result = await service.createShipment(
      createBody as any,
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.documentShipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invoice_id: 'inv-1',
        courier: 'JNE',
        tracking_number: 'TRK-001',
      }),
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: {
        action: 'CREATE',
        reference_id: 'ship-1',
        reference_type: 'INVOICE',
        user_id: 'admin-1',
        description:
          'Super Admin created a new shipment with tracking number TRK-001',
      },
    });
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'SHIPPED' },
    });
    expect(result).toEqual({ id: 'ship-1' });
  });

  it('updates shipment and writes log when valid', async () => {
    const existing = {
      id: 'ship-1',
      invoice_id: 'inv-1',
      courier: 'JNE',
      tracking_number: 'TRK-001',
      shipping_date: new Date(),
    };

    prismaMock.documentShipment.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    prismaMock.documentShipment.update.mockResolvedValue({
      ...existing,
      courier: 'JNT',
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.updateShipment(
      'ship-1',
      { courier: 'JNT' } as any,
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.documentShipment.update).toHaveBeenCalledWith({
      where: { id: 'ship-1' },
      data: expect.objectContaining({
        courier: 'JNT',
      }),
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'UPDATE',
        reference_id: 'ship-1',
        reference_type: 'INVOICE',
        user_id: 'admin-1',
      }),
    });
    expect(result).toEqual({
      ...existing,
      courier: 'JNT',
    });
  });

  it('soft deletes shipment and writes log when valid', async () => {
    prismaMock.documentShipment.findFirst.mockResolvedValue({
      id: 'ship-1',
      tracking_number: 'TRK-001',
      deleted_at: null,
    });
    prismaMock.documentShipment.update.mockResolvedValue({
      id: 'ship-1',
      deleted_at: new Date(),
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.deleteShipment(
      'ship-1',
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.documentShipment.update).toHaveBeenCalledWith({
      where: { id: 'ship-1' },
      data: {
        deleted_at: expect.any(Date),
      },
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DELETE',
        reference_id: 'ship-1',
        reference_type: 'INVOICE',
        user_id: 'admin-1',
      }),
    });
  });
});
