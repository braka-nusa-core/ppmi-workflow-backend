import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserGuard } from '../common/guards/user.guard';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';

describe('ShipmentsController', () => {
  let controller: ShipmentsController;
  const shipmentsServiceMock = {
    listShipments: vi.fn(),
    getShipment: vi.fn(),
    createShipment: vi.fn(),
    updateShipment: vi.fn(),
    deleteShipment: vi.fn(),
  };

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [ShipmentsController],
      providers: [
        { provide: ShipmentsService, useValue: shipmentsServiceMock },
      ],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(UserGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ShipmentsController>(ShipmentsController);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns shipments list response', async () => {
    shipmentsServiceMock.listShipments.mockResolvedValue({
      items: [{ id: 'ship-1' }],
      total_pages: 2,
      current_page: 1,
    });

    const result = await controller.listShipments({
      invoice_id: 'inv-1',
      page: '1',
      limit: '10',
    });

    expect(shipmentsServiceMock.listShipments).toHaveBeenCalledWith({
      invoice_id: 'inv-1',
      page: '1',
      limit: '10',
    });
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: {
        items: [{ id: 'ship-1' }],
        total_pages: 2,
        current_page: 1,
      },
    });
  });

  it('returns shipment detail response', async () => {
    shipmentsServiceMock.getShipment.mockResolvedValue({ id: 'ship-1' });

    const result = await controller.getShipment('ship-1');

    expect(shipmentsServiceMock.getShipment).toHaveBeenCalledWith('ship-1');
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'ship-1' },
    });
  });

  it('returns create shipment response', async () => {
    shipmentsServiceMock.createShipment.mockResolvedValue({ id: 'ship-1' });

    const result = await controller.createShipment(
      { courier: 'JNE' } as any,
      { credentials: { fullname: 'Super Admin', id: 'admin-1' } } as any,
    );

    expect(shipmentsServiceMock.createShipment).toHaveBeenCalledWith(
      { courier: 'JNE' },
      'Super Admin',
      'admin-1',
    );
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.CREATED,
      data: { id: 'ship-1' },
    });
  });

  it('returns update shipment response', async () => {
    shipmentsServiceMock.updateShipment.mockResolvedValue({ id: 'ship-1' });

    const result = await controller.updateShipment(
      'ship-1',
      { courier: 'JNT' } as any,
      { credentials: { fullname: 'Super Admin', id: 'admin-1' } } as any,
    );

    expect(shipmentsServiceMock.updateShipment).toHaveBeenCalledWith(
      'ship-1',
      { courier: 'JNT' },
      'Super Admin',
      'admin-1',
    );
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'ship-1' },
    });
  });

  it('returns delete shipment response', async () => {
    shipmentsServiceMock.deleteShipment.mockResolvedValue({ id: 'ship-1' });

    const result = await controller.deleteShipment('ship-1', {
      credentials: { fullname: 'Super Admin', id: 'admin-1' },
    } as any);

    expect(shipmentsServiceMock.deleteShipment).toHaveBeenCalledWith(
      'ship-1',
      'Super Admin',
      'admin-1',
    );
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'ship-1' },
    });
  });
});
