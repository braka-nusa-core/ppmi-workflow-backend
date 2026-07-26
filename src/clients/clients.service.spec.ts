import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  const prismaMock = {
    client: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };

  const actor = { id: 'user-1', fullname: 'User Test' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns clients excluding soft-deleted ones', async () => {
      const expected = [
        {
          id: 'client-1',
          clientCode: 'CLT-20250725-001',
          name: 'PT ABC',
        },
      ];
      prismaMock.client.findMany.mockResolvedValue(expected);

      const result = await service.list();

      expect(prismaMock.client.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('get', () => {
    it('returns a client by id', async () => {
      const expected = {
        id: 'client-1',
        clientCode: 'CLT-20250725-001',
        name: 'PT ABC',
      };
      prismaMock.client.findFirst.mockResolvedValue(expected);

      const result = await service.get('client-1');

      expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
        where: { id: 'client-1', deletedAt: null },
      });
      expect(result).toEqual(expected);
    });

    it('throws NotFoundException when client is not found', async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      await expect(service.get('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generateClientCode', () => {
    it('generates code with seq 001 when no prior code exists today', async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      const code = await service.generateClientCode();

      expect(code).toMatch(/^CLT-\d{8}-001$/);
    });

    it('increments sequence when prior code exists', async () => {
      prismaMock.client.findFirst.mockResolvedValue({
        clientCode: 'CLT-20250725-003',
      });

      const code = await service.generateClientCode();

      expect(code).toMatch(/^CLT-\d{8}-004$/);
    });
  });

  describe('create', () => {
    it('creates a client with auto-generated code and audit log', async () => {
      const dto = { name: 'PT ABC', address: 'Jakarta' };
      const newClient = {
        id: 'client-1',
        clientCode: 'CLT-20250725-001',
        name: 'PT ABC',
        address: 'Jakarta',
      };

      vi.spyOn(service, 'generateClientCode').mockResolvedValue(
        'CLT-20250725-001',
      );
      prismaMock.$transaction.mockImplementation(async (cb: Function) => {
        return cb(prismaMock);
      });
      prismaMock.client.create.mockResolvedValue(newClient);

      const result = await service.create(dto, actor);

      expect(prismaMock.client.create).toHaveBeenCalledWith({
        data: {
          clientCode: 'CLT-20250725-001',
          name: 'PT ABC',
          address: 'Jakarta',
          phone: undefined,
          email: undefined,
          contactPerson: undefined,
        },
      });
      expect(prismaMock.log.create).toHaveBeenCalledWith({
        data: {
          action: 'CREATE',
          referenceId: 'client-1',
          referenceType: 'QUOTATION_SLIP',
          userId: 'user-1',
          description: 'User Test created client PT ABC (CLT-20250725-001)',
        },
      });
      expect(result).toEqual(newClient);
    });
  });

  describe('update', () => {
    it('updates a client and creates audit log', async () => {
      const existing = {
        id: 'client-1',
        name: 'PT ABC',
        clientCode: 'CLT-20250725-001',
      };
      const dto = { name: 'PT ABC Updated' };
      const updated = { ...existing, name: 'PT ABC Updated' };

      prismaMock.client.findFirst.mockResolvedValue(existing);
      prismaMock.$transaction.mockImplementation(async (cb: Function) => {
        return cb(prismaMock);
      });
      prismaMock.client.update.mockResolvedValue(updated);

      const result = await service.update('client-1', dto, actor);

      expect(prismaMock.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { name: 'PT ABC Updated' },
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when client does not exist', async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'X' }, actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('soft deletes a client and creates audit log', async () => {
      const existing = {
        id: 'client-1',
        name: 'PT ABC',
        clientCode: 'CLT-20250725-001',
      };

      prismaMock.client.findFirst.mockResolvedValue(existing);
      prismaMock.$transaction.mockImplementation(async (cb: Function) => {
        return cb(prismaMock);
      });

      const result = await service.delete('client-1', actor);

      expect(prismaMock.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'client-1' });
    });

    it('throws NotFoundException when client does not exist', async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      await expect(service.delete('nonexistent', actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
