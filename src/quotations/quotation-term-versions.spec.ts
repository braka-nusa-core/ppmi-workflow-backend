import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotationTermVersionsService } from './quotation-term-versions.service';
import {
  TermSnapshot,
  compareTermSets,
  createTermVersion,
} from './quotation-term-versions.util';

const term = (
  overrides: Partial<TermSnapshot> & { id: string },
): TermSnapshot => ({
  termsConditionId: null,
  code: null,
  section: 'TERMS_CONDITIONS',
  description: 'text',
  isSelected: true,
  isEditable: false,
  isRemovable: false,
  selectionGroup: null,
  conditionRule: null,
  sortOrder: 0,
  ...overrides,
});

describe('compareTermSets', () => {
  it('reports unchanged, added and removed catalogue terms', () => {
    const before = [
      term({ id: 't1', termsConditionId: 'tc-1' }),
      term({ id: 't2', termsConditionId: 'tc-2' }),
    ];
    const after = [
      term({ id: 't1', termsConditionId: 'tc-1' }),
      term({ id: 't3', termsConditionId: 'tc-3' }),
    ];

    const result = compareTermSets(before, after);

    expect(result.unchanged).toBe(1);
    expect(result.added.map((t) => t.id)).toEqual(['t3']);
    expect(result.removed.map((t) => t.id)).toEqual(['t2']);
    expect(result.changed).toEqual([]);
    expect(result.notComparable).toBeNull();
  });

  it('lists which fields changed on the same term', () => {
    const result = compareTermSets(
      [term({ id: 't1', termsConditionId: 'tc-1', isSelected: true })],
      [
        term({
          id: 't1',
          termsConditionId: 'tc-1',
          isSelected: false,
          description: 'new wording',
        }),
      ],
    );

    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].fields).toEqual(['description', 'isSelected']);
  });

  it('does not treat re-ordering as a change', () => {
    const result = compareTermSets(
      [term({ id: 't1', termsConditionId: 'tc-1', sortOrder: 0 })],
      [term({ id: 't1', termsConditionId: 'tc-1', sortOrder: 5 })],
    );

    expect(result.changed).toEqual([]);
    expect(result.unchanged).toBe(1);
  });

  it('matches a catalogue term that was deleted and added back', () => {
    const result = compareTermSets(
      [term({ id: 'old', termsConditionId: 'tc-1', description: 'A' })],
      [term({ id: 'new', termsConditionId: 'tc-1', description: 'B' })],
    );

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].fields).toEqual(['description']);
  });

  it('puts unmatched free-text terms in notComparable with a note', () => {
    const result = compareTermSets(
      [term({ id: 'a', description: 'old free text' })],
      [term({ id: 'b', description: 'rewritten free text' })],
    );

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.notComparable?.before.map((t) => t.id)).toEqual(['a']);
    expect(result.notComparable?.after.map((t) => t.id)).toEqual(['b']);
    expect(result.notComparable?.note).toContain('cannot be matched');
  });

  it('ignores key order when comparing condition rules', () => {
    const result = compareTermSets(
      [term({ id: 't1', conditionRule: { a: 1, b: { c: 2, d: 3 } } })],
      [term({ id: 't1', conditionRule: { b: { d: 3, c: 2 }, a: 1 } })],
    );

    expect(result.changed).toEqual([]);
  });
});

describe('createTermVersion', () => {
  const dbMock = {
    quotationTerm: { findMany: vi.fn() },
    quotationTermVersion: { findFirst: vi.fn(), create: vi.fn() },
  };

  const liveTerm = {
    id: 't1',
    termsConditionId: 'tc-1',
    termsCondition: { code: 'ITC-280', description: 'catalogue text' },
    section: 'TERMS_CONDITIONS',
    description: null,
    isSelected: true,
    isEditable: false,
    isRemovable: false,
    selectionGroup: null,
    conditionRule: null,
    sortOrder: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.quotationTerm.findMany.mockResolvedValue([liveTerm]);
    dbMock.quotationTermVersion.create.mockImplementation(
      async (args) => args.data,
    );
  });

  it('creates version 1 when there is none and falls back to the catalogue wording', async () => {
    dbMock.quotationTermVersion.findFirst.mockResolvedValue(null);

    await createTermVersion(dbMock as any, 'q-1', 'SUBMIT', { actorId: 'u-1' });

    const data = dbMock.quotationTermVersion.create.mock.calls[0][0].data;
    expect(data.version).toBe(1);
    expect(data.reason).toBe('SUBMIT');
    expect(data.createdById).toBe('u-1');
    expect(data.terms[0]).toMatchObject({
      code: 'ITC-280',
      description: 'catalogue text',
    });
  });

  it('skips a new version when nothing changed since the latest one', async () => {
    dbMock.quotationTermVersion.findFirst.mockResolvedValue({
      version: 3,
      terms: [
        {
          id: 't1',
          termsConditionId: 'tc-1',
          code: 'ITC-280',
          section: 'TERMS_CONDITIONS',
          description: 'catalogue text',
          isSelected: true,
          isEditable: false,
          isRemovable: false,
          selectionGroup: null,
          conditionRule: null,
          sortOrder: 0,
        },
      ],
    });

    const result = await createTermVersion(dbMock as any, 'q-1', 'SUBMIT');

    expect(result).toBeNull();
    expect(dbMock.quotationTermVersion.create).not.toHaveBeenCalled();
  });

  it('always creates a version when forced, numbering after the latest', async () => {
    dbMock.quotationTermVersion.findFirst.mockResolvedValue({
      version: 3,
      terms: [],
    });

    await createTermVersion(dbMock as any, 'q-1', 'MANUAL', { force: true });

    expect(
      dbMock.quotationTermVersion.create.mock.calls[0][0].data.version,
    ).toBe(4);
  });
});

describe('QuotationTermVersionsService', () => {
  const prismaMock = {
    quotation: { findFirst: vi.fn() },
    quotationTerm: { findMany: vi.fn() },
    quotationTermVersion: { findUnique: vi.fn(), findMany: vi.fn() },
  };
  let service: QuotationTermVersionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quotation.findFirst.mockResolvedValue({ id: 'q-1' });
    service = new QuotationTermVersionsService(prismaMock as any);
  });

  it('rejects an unknown quotation', async () => {
    prismaMock.quotation.findFirst.mockResolvedValue(null);

    await expect(service.list('missing')).rejects.toThrow(NotFoundException);
  });

  it('rejects an unknown version', async () => {
    prismaMock.quotationTermVersion.findUnique.mockResolvedValue(null);

    await expect(service.get('q-1', 9)).rejects.toThrow(
      'Terms version not found',
    );
  });

  it('compares a saved version with the live terms', async () => {
    prismaMock.quotationTermVersion.findUnique.mockResolvedValue({
      version: 1,
      reason: 'SUBMIT',
      createdAt: new Date('2026-11-01'),
      terms: [term({ id: 't1', termsConditionId: 'tc-1' })],
    });
    prismaMock.quotationTerm.findMany.mockResolvedValue([]);

    const result = await service.compare('q-1', 1, 'current');

    expect(result.to).toBe('current');
    expect(result.removed.map((t) => t.id)).toEqual(['t1']);
  });

  it('refuses to compare a version with itself', async () => {
    prismaMock.quotationTermVersion.findUnique.mockResolvedValue({
      version: 2,
      reason: 'SUBMIT',
      createdAt: new Date(),
      terms: [],
    });

    await expect(service.compare('q-1', 2, 2)).rejects.toThrow(
      'two different versions',
    );
  });

  it('summarises versions without returning every term', async () => {
    prismaMock.quotationTermVersion.findMany.mockResolvedValue([
      { id: 'v2', version: 2, reason: 'SUBMIT', terms: [{}, {}, {}] },
    ]);

    const [version] = await service.list('q-1');

    expect(version).toMatchObject({ version: 2, termCount: 3 });
    expect('terms' in version).toBe(false);
  });
});
