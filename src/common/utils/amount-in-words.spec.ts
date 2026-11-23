import { describe, expect, it } from 'vitest';
import { amountInWords } from './amount-in-words';

describe('amountInWords', () => {
  it('writes the sample invoice sentence', () => {
    expect(amountInWords('43100195.25', 'IDR')).toBe(
      'Forty-three million one hundred thousand one hundred ninety-five Indonesian Rupiah and twenty-five cents.',
    );
    expect(amountInWords(43100195.25, 'IDR')).toBe(
      amountInWords('43100195.25', 'IDR'),
    );
  });

  it('writes zero', () => {
    expect(amountInWords(0, 'IDR')).toBe('Zero Indonesian Rupiah.');
  });

  it('omits cents when they are zero', () => {
    expect(amountInWords('1500000.00', 'IDR')).toBe(
      'One million five hundred thousand Indonesian Rupiah.',
    );
  });

  it('handles USD, singular forms, and cents only', () => {
    expect(amountInWords('1250.50', 'USD')).toBe(
      'One thousand two hundred fifty US Dollars and fifty cents.',
    );
    expect(amountInWords('1', 'USD')).toBe('One US Dollar.');
    expect(amountInWords('2.01', 'USD')).toBe('Two US Dollars and one cent.');
    expect(amountInWords('0.5', 'USD')).toBe(
      'Zero US Dollars and fifty cents.',
    );
  });

  it('skips empty scale groups', () => {
    expect(amountInWords('1000005', 'IDR')).toBe(
      'One million five Indonesian Rupiah.',
    );
    expect(amountInWords('100', 'IDR')).toBe('One hundred Indonesian Rupiah.');
  });

  it('handles billions and trillions', () => {
    expect(amountInWords('28633463500.00', 'IDR')).toBe(
      'Twenty-eight billion six hundred thirty-three million four hundred sixty-three thousand five hundred Indonesian Rupiah.',
    );
    expect(amountInWords('2000000000000.01', 'IDR')).toBe(
      'Two trillion Indonesian Rupiah and one cent.',
    );
    expect(amountInWords('999999999999999.99', 'USD')).toBe(
      'Nine hundred ninety-nine trillion nine hundred ninety-nine billion nine hundred ninety-nine million nine hundred ninety-nine thousand nine hundred ninety-nine US Dollars and ninety-nine cents.',
    );
  });

  it('rounds half up to 2 decimals using decimal arithmetic', () => {
    expect(amountInWords('10.005', 'USD')).toBe('Ten US Dollars and one cent.');
    expect(amountInWords('10.004', 'USD')).toBe('Ten US Dollars.');
    expect(amountInWords('0.995', 'USD')).toBe('One US Dollar.');
    expect(amountInWords({ toFixed: () => '42950195.25' }, 'IDR')).toContain(
      'Forty-two million',
    );
  });

  it('rejects negative and malformed amounts', () => {
    expect(() => amountInWords('-1', 'IDR')).toThrow(RangeError);
    expect(() => amountInWords('abc', 'IDR')).toThrow(RangeError);
  });
});
