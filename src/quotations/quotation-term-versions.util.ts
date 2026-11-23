import { Prisma } from '../generated/prisma/client';

type Db = Pick<
  Prisma.TransactionClient,
  'quotationTerm' | 'quotationTermVersion'
>;

export type TermSnapshot = {
  id: string;
  termsConditionId: string | null;
  code: string | null;
  section: string;
  description: string | null;
  isSelected: boolean;
  isEditable: boolean;
  isRemovable: boolean;
  selectionGroup: string | null;
  conditionRule: unknown;
  sortOrder: number;
};

export type TermChange = {
  before: TermSnapshot;
  after: TermSnapshot;
  /** Names of the fields that differ. */
  fields: string[];
};

export type TermComparison = {
  added: TermSnapshot[];
  removed: TermSnapshot[];
  changed: TermChange[];
  unchanged: number;
  /**
   * Free-text terms (no catalogue reference) that exist on only one side. They
   * may be a rewrite of the same clause, so they are listed instead of being
   * reported as added or removed.
   */
  notComparable: {
    before: TermSnapshot[];
    after: TermSnapshot[];
    note: string;
  } | null;
};

// sortOrder is left out on purpose: re-ordering is not a change to the terms.
const COMPARED_FIELDS = [
  'description',
  'section',
  'isSelected',
  'isEditable',
  'isRemovable',
  'selectionGroup',
  'conditionRule',
] as const;

const NOT_COMPARABLE_NOTE =
  'These terms have no catalogue reference, so they cannot be matched automatically between the two versions. Review them manually.';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** The live terms of a quotation, in the shape stored in a version. */
export async function snapshotTerms(
  db: Pick<Db, 'quotationTerm'>,
  quotationId: string,
): Promise<TermSnapshot[]> {
  const terms = await db.quotationTerm.findMany({
    where: { quotationId, deletedAt: null },
    include: { termsCondition: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return terms.map((term) => ({
    id: term.id,
    termsConditionId: term.termsConditionId,
    code: term.termsCondition?.code ?? null,
    section: term.section,
    // The wording the client actually sees: a custom text wins over the catalogue.
    description: term.description ?? term.termsCondition?.description ?? null,
    isSelected: term.isSelected,
    isEditable: term.isEditable,
    isRemovable: term.isRemovable,
    selectionGroup: term.selectionGroup,
    conditionRule: term.conditionRule ?? null,
    sortOrder: term.sortOrder,
  }));
}

/**
 * Stores the current terms as the next version. Returns null when nothing
 * changed since the latest version, unless `force` is set.
 */
export async function createTermVersion(
  db: Db,
  quotationId: string,
  reason: string,
  options: { actorId?: string; note?: string; force?: boolean } = {},
) {
  const terms = await snapshotTerms(db, quotationId);
  const latest = await db.quotationTermVersion.findFirst({
    where: { quotationId },
    orderBy: { version: 'desc' },
    select: { version: true, terms: true },
  });

  if (
    !options.force &&
    latest &&
    stableStringify(latest.terms) === stableStringify(terms)
  ) {
    return null;
  }

  return db.quotationTermVersion.create({
    data: {
      quotationId,
      version: (latest?.version ?? 0) + 1,
      reason,
      note: options.note,
      terms: terms as unknown as Prisma.InputJsonValue,
      createdById: options.actorId,
    },
  });
}

export function compareTermSets(
  before: TermSnapshot[],
  after: TermSnapshot[],
): TermComparison {
  const unmatchedBefore = new Map(before.map((term) => [term.id, term]));
  const pairs: [TermSnapshot, TermSnapshot][] = [];
  const unmatchedAfter: TermSnapshot[] = [];

  // Pass 1: the same term row in both versions.
  for (const term of after) {
    const match = unmatchedBefore.get(term.id);
    if (match) {
      pairs.push([match, term]);
      unmatchedBefore.delete(term.id);
    } else {
      unmatchedAfter.push(term);
    }
  }

  // Pass 2: a catalogue term that was removed and added back is the same term.
  const byCatalogue = new Map<string, TermSnapshot>();
  for (const term of unmatchedBefore.values()) {
    if (term.termsConditionId) {
      byCatalogue.set(`${term.termsConditionId}|${term.section}`, term);
    }
  }
  const added: TermSnapshot[] = [];
  const freeTextAfter: TermSnapshot[] = [];
  for (const term of unmatchedAfter) {
    const key = term.termsConditionId
      ? `${term.termsConditionId}|${term.section}`
      : null;
    const match = key ? byCatalogue.get(key) : undefined;
    if (key && match) {
      pairs.push([match, term]);
      byCatalogue.delete(key);
      unmatchedBefore.delete(match.id);
    } else if (term.termsConditionId) {
      added.push(term);
    } else {
      freeTextAfter.push(term);
    }
  }

  const removed: TermSnapshot[] = [];
  const freeTextBefore: TermSnapshot[] = [];
  for (const term of unmatchedBefore.values()) {
    if (term.termsConditionId) removed.push(term);
    else freeTextBefore.push(term);
  }

  const changed: TermChange[] = [];
  let unchanged = 0;
  for (const [was, now] of pairs) {
    const fields = COMPARED_FIELDS.filter(
      (field) => stableStringify(was[field]) !== stableStringify(now[field]),
    );
    if (fields.length > 0)
      changed.push({ before: was, after: now, fields: [...fields] });
    else unchanged += 1;
  }

  return {
    added,
    removed,
    changed,
    unchanged,
    notComparable:
      freeTextBefore.length + freeTextAfter.length > 0
        ? {
            before: freeTextBefore,
            after: freeTextAfter,
            note: NOT_COMPARABLE_NOTE,
          }
        : null,
  };
}
