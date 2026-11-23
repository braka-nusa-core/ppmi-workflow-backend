import { describe, expect, it } from 'vitest';
import { calculateInvoice, serializeFigures } from './invoice-calculation';

describe('calculateInvoice', () => {
  const sampleItem = {
    description: 'DEWI SAMUDRA XXI',
    sumInsured: '28633463500',
    rate: '0.15',
  };

  it('reproduces the sample invoice', () => {
    const figures = calculateInvoice({
      currency: 'IDR',
      items: [sampleItem],
      stampDutyPolicyCost: '150000',
    });

    expect(figures.items[0].total?.toFixed(2)).toBe('42950195.25');
    expect(figures.grossPremium.toFixed(2)).toBe('42950195.25');
    expect(figures.discount.toFixed(2)).toBe('0.00');
    expect(figures.nettPremium.toFixed(2)).toBe('42950195.25');
    expect(figures.balanceDue.toFixed(2)).toBe('43100195.25');
    expect(figures.amountInWords).toBe(
      'Forty-three million one hundred thousand one hundred ninety-five Indonesian Rupiah and twenty-five cents.',
    );
  });

  it('uses a given total instead of deriving it', () => {
    const figures = calculateInvoice({
      currency: 'USD',
      items: [{ ...sampleItem, total: '1000.5' }],
    });
    expect(figures.grossPremium.toFixed(2)).toBe('1000.50');
    expect(figures.amountInWords).toBe(
      'One thousand US Dollars and fifty cents.',
    );
  });

  it('sums several items and subtracts the discount', () => {
    const figures = calculateInvoice({
      currency: 'IDR',
      items: [
        { description: 'A', total: '100.10' },
        { description: 'B', sumInsured: '1000', rate: '0.1' },
        { description: 'C' },
      ],
      discount: '1.10',
      stampDutyPolicyCost: '10',
    });

    expect(figures.items[2].total).toBeNull();
    expect(figures.grossPremium.toFixed(2)).toBe('101.10');
    expect(figures.nettPremium.toFixed(2)).toBe('100.00');
    expect(figures.balanceDue.toFixed(2)).toBe('110.00');
  });

  it('rounds the derived total half up without float errors', () => {
    const figures = calculateInvoice({
      currency: 'IDR',
      items: [{ description: 'A', sumInsured: '1.15', rate: '0.5' }],
    });
    // 1.15 x 0.5% = 0.00575 -> 0.01
    expect(figures.items[0].total?.toFixed(2)).toBe('0.01');
  });

  it('serialises decimals as strings', () => {
    const json = serializeFigures(
      calculateInvoice({ currency: 'IDR', items: [sampleItem] }),
    );
    expect(json.items[0].total).toBe('42950195.25');
    expect(json.balanceDue).toBe('42950195.25');
  });
});
