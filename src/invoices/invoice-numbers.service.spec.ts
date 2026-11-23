import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import {
  DEFAULT_INVOICE_SUFFIX,
  InvoiceNumbersService,
} from './invoice-numbers.service';
import { upsertInvoiceNumberSettingSchema } from './invoices.validation';

describe('InvoiceNumbersService', () => {
  let service: InvoiceNumbersService;
  const prismaMock = {
    invoice: { findMany: vi.fn() },
    invoiceNumberSetting: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    insuranceType: { findMany: vi.fn(), findFirst: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const actor = { id: 'user-1', fullname: 'User Test' };
  const july = new Date('2026-07-20T00:00:00.000Z');

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvoiceNumbersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(InvoiceNumbersService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.invoiceNumberSetting.findUnique.mockResolvedValue(null);
  });

  it('starts at 001 each month with the default suffix', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([]);
    await expect(service.generate(july, 'type-1')).resolves.toBe(
      `001/07-26/PPMI/FIN/${DEFAULT_INVOICE_SUFFIX}`,
    );
    expect(prismaMock.invoice.findMany.mock.calls[0][0].where).toEqual({
      invoiceNumber: { contains: '/07-26/PPMI/FIN/' },
    });
  });

  it('continues after the highest sequence and ignores unrelated numbers', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      { invoiceNumber: '006/07-26/PPMI/FIN/MC' },
      { invoiceNumber: '012/07-26/PPMI/FIN/HM' },
      { invoiceNumber: 'X-007/07-26/PPMI/FIN/MC' },
      { invoiceNumber: 'abc/07-26/PPMI/FIN/MC' },
    ]);
    prismaMock.invoiceNumberSetting.findUnique.mockResolvedValue({
      suffix: 'PNI',
    });

    await expect(service.generate(july, 'type-2')).resolves.toBe(
      '013/07-26/PPMI/FIN/PNI',
    );
  });

  it('pads to three digits but grows past 999', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      { invoiceNumber: '999/01-27/PPMI/FIN/MC' },
    ]);
    await expect(
      service.generate(new Date('2027-01-05T00:00:00.000Z'), null),
    ).resolves.toBe('1000/01-27/PPMI/FIN/MC');
  });

  it('lists settings with the default for types without a row', async () => {
    prismaMock.insuranceType.findMany.mockResolvedValue([
      { id: 't1', code: 'CARGO', name: 'Cargo' },
      { id: 't2', code: 'PNI', name: 'P&I' },
    ]);
    prismaMock.invoiceNumberSetting.findMany.mockResolvedValue([
      { insuranceTypeId: 't2', suffix: 'PI' },
    ]);

    const result = await service.listSettings();
    expect(result[0]).toMatchObject({ suffix: 'MC', isDefault: true });
    expect(result[1]).toMatchObject({ suffix: 'PI', isDefault: false });
  });

  it('upserts a setting and rejects an unknown insurance type', async () => {
    prismaMock.insuranceType.findFirst.mockResolvedValue(null);
    await expect(service.upsertSetting('x', 'MC', actor)).rejects.toThrow(
      NotFoundException,
    );

    prismaMock.insuranceType.findFirst.mockResolvedValue({
      id: 't1',
      code: 'CARGO',
    });
    prismaMock.invoiceNumberSetting.upsert.mockResolvedValue({ suffix: 'MC' });
    await service.upsertSetting('t1', 'MC', actor);
    expect(prismaMock.invoiceNumberSetting.upsert).toHaveBeenCalledWith({
      where: { insuranceTypeId: 't1' },
      create: { insuranceTypeId: 't1', suffix: 'MC' },
      update: { suffix: 'MC' },
    });
  });

  it('normalises and validates the suffix', () => {
    expect(
      upsertInvoiceNumberSettingSchema.parse({ suffix: ' mc1 ' }).suffix,
    ).toBe('MC1');
    expect(
      upsertInvoiceNumberSettingSchema.safeParse({ suffix: 'a-b' }).success,
    ).toBe(false);
    expect(
      upsertInvoiceNumberSettingSchema.safeParse({ suffix: '' }).success,
    ).toBe(false);
    expect(
      upsertInvoiceNumberSettingSchema.safeParse({ suffix: 'ABCDEFGHIJK' })
        .success,
    ).toBe(false);
  });
});
