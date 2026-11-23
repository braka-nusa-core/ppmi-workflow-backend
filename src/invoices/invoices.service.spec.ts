import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../common/services/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { InvoiceNumbersService } from './invoice-numbers.service';
import { InvoicesService } from './invoices.service';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
} from './invoices.validation';

const SAMPLE_WORDS =
  'Forty-three million one hundred thousand one hundred ninety-five Indonesian Rupiah and twenty-five cents.';

describe('InvoicesService', () => {
  let service: InvoicesService;

  const prismaMock = {
    invoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoiceItem: { updateMany: vi.fn(), createMany: vi.fn() },
    requestInvoice: { findFirst: vi.fn() },
    policy: { findFirst: vi.fn() },
    policyParticipant: { findFirst: vi.fn() },
    bank: { findFirst: vi.fn() },
    incomingPayment: { count: vi.fn(), aggregate: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const numbersMock = { generate: vi.fn() };
  const actor = { id: 'user-1', fullname: 'Julia' };

  const body = createInvoiceSchema.parse({
    issueDate: '2026-07-20',
    currency: 'IDR',
    billToName: 'PT. Kertas Nusantara',
    items: [
      {
        description: 'DEWI SAMUDRA XXI',
        sumInsured: 28633463500,
        rate: 0.15,
        total: 1,
      },
    ],
    stampDutyPolicyCost: '150000',
    bankId: 'bank-1',
  });
  const bank = {
    id: 'bank-1',
    name: 'Bank Mandiri Tbk',
    accountName: 'PT Pandi Proteksi Marine Indonesia',
    accountNumber: '157.00.44.004449',
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: InvoiceNumbersService, useValue: numbersMock },
      ],
    }).compile();
    service = module.get(InvoicesService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.requestInvoice.findFirst.mockResolvedValue({
      id: 'rfi-1',
      policyId: 'policy-1',
      status: 'READY_FOR_INVOICE',
    });
    prismaMock.invoice.count.mockResolvedValue(0);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.bank.findFirst.mockResolvedValue(bank);
    prismaMock.policy.findFirst.mockResolvedValue({
      quotation: { insuranceTypeId: 'type-1' },
    });
    prismaMock.invoice.create.mockImplementation(async ({ data }) => ({
      id: 'inv-1',
      invoiceNumber: data.invoiceNumber,
    }));
    numbersMock.generate.mockResolvedValue('001/07-26/PPMI/FIN/MC');
  });

  describe('preview', () => {
    it('computes totals and words, ignoring a client total', () => {
      // total: 1 is a given total, so it wins; use the derived case below.
      const derived = createInvoiceSchema.parse({
        ...body,
        items: [{ description: 'X', sumInsured: '28633463500', rate: '0.15' }],
      });
      const result = service.preview(derived);

      expect(result.items[0].total).toBe('42950195.25');
      expect(result.grossPremium).toBe('42950195.25');
      expect(result.nettPremium).toBe('42950195.25');
      expect(result.balanceDue).toBe('43100195.25');
      expect(result.amountInWords).toBe(SAMPLE_WORDS);
      expect(prismaMock.invoice.create).not.toHaveBeenCalled();
    });

    it('rejects a discount larger than the gross premium', () => {
      const bad = createInvoiceSchema.parse({
        ...body,
        items: [{ description: 'X', total: '100' }],
        discount: '100.01',
      });
      expect(() => service.preview(bad)).toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    const sample = createInvoiceSchema.parse({
      ...body,
      items: [{ description: 'X', sumInsured: '28633463500', rate: '0.15' }],
    });

    it('stores UNPAID with computed amounts, legacy columns and bank copy', async () => {
      const result = await service.create('rfi-1', sample, actor);

      expect(result.invoiceNumber).toBe('001/07-26/PPMI/FIN/MC');
      expect(numbersMock.generate).toHaveBeenCalledWith(
        sample.issueDate,
        'type-1',
      );
      const data = prismaMock.invoice.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        requestInvoiceId: 'rfi-1',
        status: 'UNPAID',
        paymentTermDays: 14,
        grossPremium: '42950195.25',
        discount: '0.00',
        nettPremium: '42950195.25',
        stampDutyPolicyCost: '150000.00',
        balanceDue: '43100195.25',
        subtotal: '42950195.25',
        grandTotal: '43100195.25',
        ppn: null,
        amountInWords: SAMPLE_WORDS,
        bankName: 'Bank Mandiri Tbk',
        bankAccountNumber: '157.00.44.004449',
        issuedById: 'user-1',
      });
      expect(data.dueDate.toISOString()).toBe('2026-08-03T00:00:00.000Z');
      expect(data.items.create[0]).toMatchObject({
        sortOrder: 0,
        total: '42950195.25',
      });
      expect(prismaMock.log.create.mock.calls[0][0].data.referenceType).toBe(
        'INVOICE',
      );
    });

    it('keeps a supplied number and does not generate one', async () => {
      await service.create(
        'rfi-1',
        { ...sample, invoiceNumber: '007/07-26/PPMI/FIN/MC' },
        actor,
      );
      expect(numbersMock.generate).not.toHaveBeenCalled();
    });

    it('refuses a request that is not READY_FOR_INVOICE', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue({
        id: 'rfi-1',
        status: 'RFI_SUBMITTED',
      });
      await expect(service.create('rfi-1', sample, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a second invoice for the same request', async () => {
      prismaMock.invoice.count.mockResolvedValue(1);
      await expect(service.create('rfi-1', sample, actor)).rejects.toThrow(
        /already exists/,
      );
    });

    it('refuses a duplicate number and an unknown bank', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue({ id: 'other' });
      await expect(service.create('rfi-1', sample, actor)).rejects.toThrow(
        /already used/,
      );

      prismaMock.invoice.findFirst.mockResolvedValue(null);
      prismaMock.bank.findFirst.mockResolvedValue(null);
      await expect(service.create('rfi-1', sample, actor)).rejects.toThrow(
        'Bank not found',
      );
    });

    it('maps a Prisma P2002 to a 400', async () => {
      prismaMock.invoice.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.create('rfi-1', sample, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns 404 for an unknown request', async () => {
      prismaMock.requestInvoice.findFirst.mockResolvedValue(null);
      await expect(service.create('x', sample, actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('draft', () => {
    const quotation = {
      id: 'q-1',
      insuranceTypeId: 'type-1',
      interest: 'Coal',
      sumInsured: new Prisma.Decimal('28633463500'),
      sumInsuredCurrency: 'IDR',
      rate: new Prisma.Decimal('0.15'),
      client: { name: 'PT. Kertas Nusantara', address: 'Menara Bidakara' },
      insuranceType: { code: 'CARGO' },
      cargoQuotation: {
        voyageFrom: 'Tanjung Perak',
        voyageTo: 'Mangkajang',
        interestInsured: 'As Per List',
        etd: new Date('2026-07-01T00:00:00Z'),
        eta: new Date('2026-08-01T00:00:00Z'),
      },
      pniQuotation: null,
      objects: [{ data: { name: 'DEWI SAMUDRA XXI' } }],
    };

    beforeEach(() => {
      prismaMock.policy.findFirst.mockResolvedValue({
        id: 'policy-1',
        policyNumber: '0306.26.017.2.00005-0/00',
        periodStart: new Date('2026-07-13T00:00:00Z'),
        periodEnd: new Date('2026-08-13T00:00:00Z'),
        quotation,
      });
      prismaMock.policyParticipant.findFirst.mockResolvedValue({
        insuranceCompany: { name: 'Askrindo' },
      });
    });

    it('prefills the form from the policy and quotation', async () => {
      const draft = await service.draft('rfi-1');

      expect(draft).toMatchObject({
        invoiceNumber: '001/07-26/PPMI/FIN/MC',
        paymentTermDays: 14,
        currency: 'IDR',
        insuranceTypeLabel: 'CARGO',
        billToName: 'PT. Kertas Nusantara',
        coverName: 'Askrindo',
        bankId: 'bank-1',
        paymentDetail: 'FULL PAYMENT',
        balanceDue: '42950195.25',
      });
      expect(draft.items[0]).toMatchObject({
        description: 'DEWI SAMUDRA XXI',
        policyNumber: '0306.26.017.2.00005-0/00',
        voyageFrom: 'Tanjung Perak',
        subjectInterest: 'As Per List',
        total: '42950195.25',
      });
      expect(draft.items[0].sailingStart?.toISOString()).toBe(
        '2026-07-13T00:00:00.000Z',
      );
      expect(draft.dueDate.getTime() - draft.issueDate.getTime()).toBe(
        14 * 86_400_000,
      );
    });

    it('falls back to IDR, P&I vessel name and the quotation interest', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({
        id: 'policy-1',
        policyNumber: 'P',
        periodStart: null,
        periodEnd: null,
        quotation: {
          ...quotation,
          sumInsuredCurrency: 'EUR',
          cargoQuotation: null,
          pniQuotation: { vessels: [{ name: 'KAIROS JAYA' }] },
        },
      });

      const draft = await service.draft('rfi-1');
      expect(draft.currency).toBe('IDR');
      expect(draft.items[0]).toMatchObject({
        description: 'KAIROS JAYA',
        subjectInterest: 'Coal',
        sailingStart: null,
      });
    });

    it('refuses when an invoice already exists', async () => {
      prismaMock.invoice.count.mockResolvedValue(1);
      await expect(service.draft('rfi-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    const existing = {
      id: 'inv-1',
      invoiceNumber: '001/07-26/PPMI/FIN/MC',
      currency: 'IDR',
      issueDate: new Date('2026-07-20T00:00:00Z'),
      paymentTermDays: 14,
      discount: new Prisma.Decimal(0),
      stampDutyPolicyCost: new Prisma.Decimal(150000),
      items: [
        {
          description: 'A',
          sumInsured: new Prisma.Decimal('1000'),
          rate: new Prisma.Decimal('0.1'),
          total: new Prisma.Decimal('1.00'),
        },
      ],
    };

    beforeEach(() => {
      prismaMock.invoice.findFirst.mockResolvedValue(existing);
      prismaMock.incomingPayment.count.mockResolvedValue(0);
      prismaMock.invoice.update.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: existing.invoiceNumber,
      });
    });

    it('refuses once a payment exists', async () => {
      prismaMock.incomingPayment.count.mockResolvedValue(1);
      await expect(
        service.update('inv-1', updateInvoiceSchema.parse({}), actor),
      ).rejects.toThrow(/payments/);
    });

    it('replaces items and recomputes the totals', async () => {
      await service.update(
        'inv-1',
        updateInvoiceSchema.parse({
          items: [{ description: 'B', total: '200.50' }],
          discount: '0.50',
        }),
        actor,
      );

      expect(prismaMock.invoiceItem.updateMany).toHaveBeenCalled();
      expect(
        prismaMock.invoiceItem.createMany.mock.calls[0][0].data[0],
      ).toMatchObject({
        invoiceId: 'inv-1',
        description: 'B',
        total: '200.50',
      });
      expect(prismaMock.invoice.update.mock.calls[0][0].data).toMatchObject({
        grossPremium: '200.50',
        nettPremium: '200.00',
        balanceDue: '150200.00',
        grandTotal: '150200.00',
      });
    });

    it('recomputes from the stored items when only a discount changes', async () => {
      await service.update(
        'inv-1',
        updateInvoiceSchema.parse({ discount: '0.25' }),
        actor,
      );

      expect(prismaMock.invoiceItem.createMany).not.toHaveBeenCalled();
      expect(prismaMock.invoice.update.mock.calls[0][0].data).toMatchObject({
        grossPremium: '1.00',
        nettPremium: '0.75',
        balanceDue: '150000.75',
      });
    });

    it('recomputes the due date when the term changes', async () => {
      await service.update(
        'inv-1',
        updateInvoiceSchema.parse({ paymentTermDays: 30 }),
        actor,
      );
      expect(
        prismaMock.invoice.update.mock.calls[0][0].data.dueDate.toISOString(),
      ).toBe('2026-08-19T00:00:00.000Z');
    });

    it('rejects a number used by another invoice', async () => {
      prismaMock.invoice.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ id: 'other' });
      await expect(
        service.update(
          'inv-1',
          updateInvoiceSchema.parse({ invoiceNumber: '002/07-26/PPMI/FIN/MC' }),
          actor,
        ),
      ).rejects.toThrow(/already used/);
    });
  });

  describe('get', () => {
    it('adds a payment summary from PAID payments', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        balanceDue: new Prisma.Decimal('43100195.25'),
        items: [],
        documents: [],
      });
      prismaMock.incomingPayment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('10000000') },
      });

      const result = await service.get('inv-1');
      expect(result.paymentSummary).toEqual({
        balanceDue: '43100195.25',
        paidAmount: '10000000.00',
        remaining: '33100195.25',
      });
      expect(
        prismaMock.incomingPayment.aggregate.mock.calls[0][0].where,
      ).toEqual({ invoiceId: 'inv-1', deletedAt: null, status: 'PAID' });
    });

    it('throws for a missing invoice', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue(null);
      await expect(service.get('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('applies filters and paginates', async () => {
      prismaMock.invoice.findMany.mockResolvedValue([]);
      prismaMock.invoice.count.mockResolvedValue(0);

      const result = await service.list({
        status: 'UNPAID',
        currency: 'USD',
        q: '007',
        page: 2,
        limit: 10,
      });

      const args = prismaMock.invoice.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({
        deletedAt: null,
        status: 'UNPAID',
        currency: 'USD',
        invoiceNumber: { contains: '007', mode: 'insensitive' },
      });
      expect(args.skip).toBe(10);
      expect(result).toMatchObject({ total: 0, page: 2, limit: 10 });
    });
  });
});

describe('invoice schemas', () => {
  const base = {
    issueDate: '2026-07-20',
    currency: 'IDR',
    billToName: 'X',
    items: [{ description: 'A' }],
  };

  it('requires at least one item with a description', () => {
    expect(createInvoiceSchema.safeParse({ ...base, items: [] }).success).toBe(
      false,
    );
    expect(
      createInvoiceSchema.safeParse({ ...base, items: [{}] }).success,
    ).toBe(false);
  });

  it('rejects negative amounts and too many decimals', () => {
    const withItem = (item: object) =>
      createInvoiceSchema.safeParse({
        ...base,
        items: [{ description: 'A', ...item }],
      }).success;

    expect(withItem({ sumInsured: -1 })).toBe(false);
    expect(withItem({ total: '1.234' })).toBe(false);
    expect(withItem({ rate: '0.12345' })).toBe(false);
    expect(withItem({ rate: '0.1234', total: '10.55' })).toBe(true);
    expect(
      createInvoiceSchema.safeParse({ ...base, discount: '-5' }).success,
    ).toBe(false);
    expect(
      createInvoiceSchema.safeParse({ ...base, currency: 'EUR' }).success,
    ).toBe(false);
  });

  it('defaults the payment term to 14 days', () => {
    expect(createInvoiceSchema.parse(base).paymentTermDays).toBe(14);
  });
});
