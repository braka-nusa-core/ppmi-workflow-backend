import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotationsService } from './quotations.service';
import { createQuotationSchema } from './quotations.validation';

describe('QuotationsService create, update, delete, and read', () => {
  const prismaMock = {
    quotation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    insuranceType: { findFirst: vi.fn() },
    client: { findFirst: vi.fn(), create: vi.fn() },
    quotationHistory: { create: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const clientsMock = { generateClientCode: vi.fn() };

  const actor = { id: 'user-1', fullname: 'User Test' };
  const technicalUser = (name: string, parent = 'Teknik') => ({
    organizationUnit: {
      id: 'unit-1',
      name,
      type: 'DEPARTMENT',
      deletedAt: null,
      parent: { name: parent, type: 'DIVISION', deletedAt: null },
    },
  });
  const editableQuotation = (status = 'DRAFT') => ({
    id: 'q-1',
    quotationNumber: 'QTN-1',
    status,
    technicalUnitId: null,
  });

  let service: QuotationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.quotation.updateMany.mockResolvedValue({ count: 1 });
    clientsMock.generateClientCode.mockResolvedValue('CL-001');
    service = new QuotationsService(
      prismaMock as any,
      clientsMock as any,
      {} as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateQuotationNumber', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 10, 23, 12, 0, 0));
    });

    it('starts at 001 on a new day', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(null);

      await expect(service.generateQuotationNumber()).resolves.toBe(
        'QTN-20261123-001',
      );
      expect(prismaMock.quotation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { quotationNumber: { startsWith: 'QTN-20261123-' } },
        }),
      );
    });

    it('continues after the last number of the day', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue({
        quotationNumber: 'QTN-20261123-009',
      });

      await expect(service.generateQuotationNumber()).resolves.toBe(
        'QTN-20261123-010',
      );
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prismaMock.quotation.findFirst.mockResolvedValue(null);
      prismaMock.user.findFirst.mockResolvedValue(technicalUser('P&I'));
      prismaMock.insuranceType.findFirst.mockResolvedValue({ id: 'it-1' });
      prismaMock.client.findFirst.mockResolvedValue({ id: 'c-1' });
      prismaMock.quotation.create.mockImplementation(async (args) => ({
        id: 'q-new',
        ...args.data,
      }));
    });

    it('creates a DRAFT owned by the creator unit, with history and an audit log', async () => {
      const result = await service.create(
        { clientId: 'c-1', insuranceTypeId: 'it-1', insured: 'PT Example' },
        actor,
      );

      expect(prismaMock.quotation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'c-1',
          insuranceTypeId: 'it-1',
          technicalUnitId: 'unit-1',
          status: 'DRAFT',
          createdById: 'user-1',
          insured: 'PT Example',
        }),
      });
      expect(result.quotationNumber).toMatch(/^QTN-\d{8}-001$/);
      expect(prismaMock.quotationHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quotationId: 'q-new',
          toStatus: 'DRAFT',
          action: 'CREATE',
        }),
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
    });

    it('creates the client inline when a client object is sent', async () => {
      prismaMock.client.create.mockResolvedValue({
        id: 'c-new',
        name: 'PT New',
        clientCode: 'CL-001',
      });

      await service.create(
        { client: { name: 'PT New' }, insuranceTypeId: 'it-1' },
        actor,
      );

      expect(prismaMock.client.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ clientCode: 'CL-001', name: 'PT New' }),
      });
      expect(prismaMock.quotation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ clientId: 'c-new' }),
      });
      expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
    });

    it('rejects an unknown insurance type', async () => {
      prismaMock.insuranceType.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ clientId: 'c-1', insuranceTypeId: 'x' }, actor),
      ).rejects.toThrow('Insurance type not found');
      expect(prismaMock.quotation.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown client', async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ clientId: 'x', insuranceTypeId: 'it-1' }, actor),
      ).rejects.toThrow('Client not found');
    });

    it.each([
      ['Finance', 'Finance'],
      ['Supervisor Teknik', 'Teknik'],
      ['P&I', 'Marketing'],
    ])(
      'only lets H&M, P&I, and Cargo under Teknik create (%s under %s is refused)',
      async (unit, parent) => {
        prismaMock.user.findFirst.mockResolvedValue(
          technicalUser(unit, parent),
        );

        await expect(
          service.create({ clientId: 'c-1', insuranceTypeId: 'it-1' }, actor),
        ).rejects.toThrow(ForbiddenException);
        expect(prismaMock.quotation.create).not.toHaveBeenCalled();
      },
    );

    it('refuses a user without any unit', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ organizationUnit: null });

      await expect(
        service.create({ clientId: 'c-1', insuranceTypeId: 'it-1' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('refuses to edit a quotation that is not DRAFT or REVISION', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(
        editableQuotation('APPROVED'),
      );

      await expect(
        service.update('q-1', { insured: 'x' }, actor),
      ).rejects.toThrow('Can only edit quotation in DRAFT or REVISION status');
      expect(prismaMock.quotation.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown client or insurance type', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(editableQuotation());
      prismaMock.client.findFirst.mockResolvedValue(null);

      await expect(
        service.update('q-1', { clientId: 'x' }, actor),
      ).rejects.toThrow('Client not found');

      prismaMock.insuranceType.findFirst.mockResolvedValue(null);
      await expect(
        service.update('q-1', { insuranceTypeId: 'x' }, actor),
      ).rejects.toThrow('Insurance type not found');
    });

    it('reports a concurrent change instead of overwriting it', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(editableQuotation());
      prismaMock.quotation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.update('q-1', { insured: 'x' }, actor),
      ).rejects.toThrow('changed concurrently');
      expect(prismaMock.quotation.update).not.toHaveBeenCalled();
    });

    it('only writes the fields that were sent', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(editableQuotation());
      prismaMock.quotation.update.mockResolvedValue({ id: 'q-1' });

      await service.update(
        'q-1',
        { insured: 'PT Changed', premium: 10 },
        actor,
      );

      expect(prismaMock.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-1' },
        data: { insured: 'PT Changed', premium: 10 },
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
    });

    it('marks the quotation as corrected when it is edited during REVISION', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(
        editableQuotation('REVISION'),
      );
      prismaMock.quotation.update.mockResolvedValue({ id: 'q-1' });

      await service.update('q-1', { insured: 'x' }, actor);

      expect(prismaMock.quotation.update.mock.calls[0][0].data).toMatchObject({
        insured: 'x',
        insurerRevisionUpdatedAt: expect.any(Date),
      });
    });

    it('does not mark a DRAFT edit as an insurer-revision fix', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(editableQuotation());
      prismaMock.quotation.update.mockResolvedValue({ id: 'q-1' });

      await service.update('q-1', { insured: 'x' }, actor);

      expect(
        'insurerRevisionUpdatedAt' in
          prismaMock.quotation.update.mock.calls[0][0].data,
      ).toBe(false);
    });
  });

  describe('delete', () => {
    it('only deletes a DRAFT', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(
        editableQuotation('REVISION'),
      );

      await expect(service.delete('q-1', actor)).rejects.toThrow(
        'Can only delete quotation in DRAFT status',
      );
      expect(prismaMock.quotation.updateMany).not.toHaveBeenCalled();
    });

    it('soft deletes a DRAFT and writes an audit log', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(editableQuotation());

      await expect(service.delete('q-1', actor)).resolves.toEqual({
        id: 'q-1',
      });
      expect(prismaMock.quotation.updateMany).toHaveBeenCalledWith({
        where: { id: 'q-1', deletedAt: null, status: 'DRAFT' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prismaMock.log.create).toHaveBeenCalled();
    });

    it('reports a concurrent change', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(editableQuotation());
      prismaMock.quotation.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.delete('q-1', actor)).rejects.toThrow(
        'changed concurrently',
      );
      expect(prismaMock.log.create).not.toHaveBeenCalled();
    });
  });

  describe('list and get', () => {
    it('lists active quotations, newest first', async () => {
      prismaMock.quotation.findMany.mockResolvedValue([]);

      await service.list();

      expect(prismaMock.quotation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('rejects an unknown or deleted quotation', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(null);

      await expect(service.get('missing')).rejects.toThrow(NotFoundException);
      expect(prismaMock.quotation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'missing', deletedAt: null } }),
      );
    });

    it('returns the quotation with its children', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue({ id: 'q-1' });

      await expect(service.get('q-1')).resolves.toEqual({ id: 'q-1' });
    });
  });
});

describe('createQuotationSchema', () => {
  it('needs either clientId or an inline client, never both', () => {
    expect(() =>
      createQuotationSchema.parse({ insuranceTypeId: 'it-1' }),
    ).toThrow();
    expect(() =>
      createQuotationSchema.parse({
        insuranceTypeId: 'it-1',
        clientId: 'c-1',
        client: { name: 'PT New' },
      }),
    ).toThrow();
    expect(
      createQuotationSchema.parse({ insuranceTypeId: 'it-1', clientId: 'c-1' })
        .clientId,
    ).toBe('c-1');
  });

  it('requires a three-letter sum insured currency', () => {
    expect(() =>
      createQuotationSchema.parse({
        insuranceTypeId: 'it-1',
        clientId: 'c-1',
        sumInsuredCurrency: 'US',
      }),
    ).toThrow();
  });
});
