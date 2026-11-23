export type WordsCurrency = 'IDR' | 'USD';

// Anything with a lossless string form (string, number, Prisma.Decimal).
type AmountInput = string | number | { toFixed(): string };

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  const unit = n % 10;
  return unit === 0
    ? TENS[Math.floor(n / 10)]
    : `${TENS[Math.floor(n / 10)]}-${ONES[unit]}`;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES[hundreds]} hundred`);
  if (rest > 0) parts.push(belowHundred(rest));
  return parts.join(' ');
}

function integerToWords(value: bigint): string {
  if (value === 0n) return 'zero';

  const groups: number[] = [];
  let rest = value;
  while (rest > 0n) {
    groups.push(Number(rest % 1000n));
    rest /= 1000n;
  }
  if (groups.length > SCALES.length) {
    throw new RangeError('Amount is too large to be written in words');
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const words = belowThousand(groups[i]);
    parts.push(SCALES[i] ? `${words} ${SCALES[i]}` : words);
  }
  return parts.join(' ');
}

/**
 * Splits an amount into whole units and cents, rounding half up to 2 decimals.
 * Works on the decimal string so no binary floating point is involved.
 */
export function splitAmount(amount: AmountInput): {
  units: bigint;
  cents: number;
} {
  const text = (
    typeof amount === 'object' ? amount.toFixed() : String(amount)
  ).trim();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new RangeError(`Invalid amount: ${text}`);
  if (match[1] && /[1-9]/.test(match[2] + (match[3] ?? ''))) {
    throw new RangeError('Amount must not be negative');
  }

  const fraction = (match[3] ?? '').padEnd(3, '0');
  let total = BigInt(match[2]) * 100n + BigInt(fraction.slice(0, 2));
  if (fraction.charCodeAt(2) >= 53) total += 1n; // third decimal >= 5

  return { units: total / 100n, cents: Number(total % 100n) };
}

/**
 * English words for an invoice total, e.g.
 * "Forty-three million one hundred thousand one hundred ninety-five
 * Indonesian Rupiah and twenty-five cents."
 */
export function amountInWords(
  amount: AmountInput,
  currency: WordsCurrency,
): string {
  const { units, cents } = splitAmount(amount);

  const currencyName =
    currency === 'USD'
      ? units === 1n
        ? 'US Dollar'
        : 'US Dollars'
      : 'Indonesian Rupiah';

  let sentence = `${integerToWords(units)} ${currencyName}`;
  if (cents > 0) {
    sentence += ` and ${belowHundred(cents)} ${cents === 1 ? 'cent' : 'cents'}`;
  }
  sentence += '.';

  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
