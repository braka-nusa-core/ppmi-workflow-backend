import { Prisma } from '../generated/prisma/client';
import { WordsCurrency, amountInWords } from '../common/utils/amount-in-words';

// 40 significant digits so sumInsured x rate is never truncated before rounding.
const D = Prisma.Decimal.clone({
  precision: 40,
  rounding: Prisma.Decimal.ROUND_HALF_UP,
});
type Dec = InstanceType<typeof D>;

export type CalcItemInput = {
  description: string;
  policyNumber?: string | null;
  voyageFrom?: string | null;
  voyageTo?: string | null;
  subjectInterest?: string | null;
  sailingStart?: Date | null;
  sailingEnd?: Date | null;
  sumInsured?: string | null;
  // Percent: 0.15 means 0.15%.
  rate?: string | null;
  total?: string | null;
};

export type CalcInput = {
  currency: WordsCurrency;
  items: CalcItemInput[];
  discount?: string | null;
  stampDutyPolicyCost?: string | null;
};

export type CalcItem = Omit<CalcItemInput, 'total'> & { total: Dec | null };

export type InvoiceFigures = {
  items: CalcItem[];
  grossPremium: Dec;
  discount: Dec;
  nettPremium: Dec;
  stampDutyPolicyCost: Dec;
  balanceDue: Dec;
  amountInWords: string;
};

const round2 = (value: Dec) => value.toDecimalPlaces(2, D.ROUND_HALF_UP);

function itemTotal(item: CalcItemInput): Dec | null {
  if (item.total != null) return round2(new D(item.total));
  if (item.sumInsured != null && item.rate != null) {
    return round2(new D(item.sumInsured).times(item.rate).div(100));
  }
  return null;
}

/**
 * Computes every invoice amount from the items. An item's `total` is the given
 * value when present, otherwise round2(sumInsured x rate / 100). Gross, nett,
 * balance and the words are always derived here, never taken from the client.
 */
export function calculateInvoice(input: CalcInput): InvoiceFigures {
  const items = input.items.map((item) => ({
    ...item,
    total: itemTotal(item),
  }));

  const grossPremium = round2(
    items.reduce((sum, item) => sum.plus(item.total ?? 0), new D(0)),
  );
  const discount = round2(new D(input.discount ?? 0));
  const nettPremium = grossPremium.minus(discount);
  const stampDutyPolicyCost = round2(new D(input.stampDutyPolicyCost ?? 0));
  const balanceDue = nettPremium.plus(stampDutyPolicyCost);

  return {
    items,
    grossPremium,
    discount,
    nettPremium,
    stampDutyPolicyCost,
    balanceDue,
    // A negative balance throws RangeError; the service rejects it earlier.
    amountInWords: balanceDue.isNegative()
      ? ''
      : amountInWords(balanceDue.toFixed(2), input.currency),
  };
}

export const money = (value: Dec | Prisma.Decimal | null | undefined) =>
  value == null ? null : value.toFixed(2);

/** Plain JSON for preview and draft responses (decimals as strings). */
export function serializeFigures(figures: InvoiceFigures) {
  return {
    items: figures.items.map((item) => ({
      ...item,
      total: money(item.total),
    })),
    grossPremium: money(figures.grossPremium),
    discount: money(figures.discount),
    nettPremium: money(figures.nettPremium),
    stampDutyPolicyCost: money(figures.stampDutyPolicyCost),
    balanceDue: money(figures.balanceDue),
    amountInWords: figures.amountInWords,
  };
}
