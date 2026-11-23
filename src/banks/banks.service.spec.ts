import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { BanksService } from './banks.service';
import { createBankSchema, listBanksQuerySchema } from './banks.validation';

describe('BanksService', () => {
  let service: BanksService;
  const prismaMock = {
    bank: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoice: { count: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const actor = { id: 'user-1', fullname: 'User Test' };
  const bank = { id: 'bank-1', name: 'Bank Mandiri Tbk' };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BanksService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(BanksService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
  });

  it('filters by currency and q and hides deleted banks', async () => {
    prismaMock.bank.findMany.mockResolvedValue([]);
    await service.list({ currency: 'IDR', q: 'mandiri' });

    const where = prismaMock.bank.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.currency).toBe('IDR');
    expect(where.OR).toHaveLength(3);
  });

  it('throws when the bank does not exist', async () => {
    prismaMock.bank.findFirst.mockResolvedValue(null);
    await expect(service.get('x')).rejects.toThrow(NotFoundException);
  });

  it('creates a bank and writes a BANK log', async () => {
    prismaMock.bank.create.mockResolvedValue(bank);
    await service.create({ name: 'Bank Mandiri Tbk', currency: 'IDR' }, actor);

    expect(prismaMock.log.create.mock.calls[0][0].data).toMatchObject({
      action: 'CREATE',
      referenceType: 'BANK',
      referenceId: 'bank-1',
    });
  });

  it('updates a bank', async () => {
    prismaMock.bank.findFirst.mockResolvedValue(bank);
    prismaMock.bank.update.mockResolvedValue(bank);
    await service.update('bank-1', { branch: 'Jakarta' }, actor);

    expect(prismaMock.bank.update).toHaveBeenCalledWith({
      where: { id: 'bank-1' },
      data: { branch: 'Jakarta' },
    });
  });

  it('refuses to delete a bank used by an invoice', async () => {
    prismaMock.bank.findFirst.mockResolvedValue(bank);
    prismaMock.invoice.count.mockResolvedValue(1);

    await expect(service.delete('bank-1', actor)).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.bank.update).not.toHaveBeenCalled();
  });

  it('soft deletes an unused bank', async () => {
    prismaMock.bank.findFirst.mockResolvedValue(bank);
    prismaMock.invoice.count.mockResolvedValue(0);
    await service.delete('bank-1', actor);

    expect(prismaMock.invoice.count).toHaveBeenCalledWith({
      where: { bankId: 'bank-1', deletedAt: null },
    });
    expect(
      prismaMock.bank.update.mock.calls[0][0].data.deletedAt,
    ).toBeInstanceOf(Date);
  });
});

describe('bank schemas', () => {
  it('requires a name and only accepts IDR or USD', () => {
    expect(createBankSchema.safeParse({}).success).toBe(false);
    expect(
      createBankSchema.safeParse({ name: 'BCA', currency: 'EUR' }).success,
    ).toBe(false);
    expect(
      createBankSchema.safeParse({ name: ' BCA ', currency: 'USD' }).data?.name,
    ).toBe('BCA');
    expect(listBanksQuerySchema.safeParse({ currency: 'IDR' }).success).toBe(
      true,
    );
  });
});
