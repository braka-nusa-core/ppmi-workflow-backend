import { describe, expect, it } from 'vitest';
import { createPniQuotationSchema } from './pni.validation';

describe('createPniQuotationSchema', () => {
  it('accepts a zero-premium War P&I insurance block', () => {
    const result = createPniQuotationSchema.parse({
      quotation: {
        clientId: 'client-1',
        insuranceTypeId: 'insurance-type-1',
      },
      pni: { clubCode: 'MSIG' },
      insuranceBlocks: [
        {
          key: 'war-pni',
          typeOfInsurance: 'War Protection and Indemnity Cover',
          premium: 0,
          premiumBasis: 'INCLUDED_NO_ADDITIONAL_CHARGE',
        },
      ],
    });

    expect(result.insuranceBlocks?.[0]?.premium).toBe(0);
  });

  it('accepts a vessel referenced only by vesselId', () => {
    const result = createPniQuotationSchema.parse({
      quotation: { clientId: 'client-1', insuranceTypeId: 'insurance-type-1' },
      pni: { clubCode: 'MSIG' },
      vessels: [{ vesselId: 'vessel-1' }],
    });

    expect(result.vessels?.[0]?.vesselId).toBe('vessel-1');
  });

  it('requires a vessel name when no vesselId is given', () => {
    expect(() =>
      createPniQuotationSchema.parse({
        quotation: {
          clientId: 'client-1',
          insuranceTypeId: 'insurance-type-1',
        },
        pni: { clubCode: 'MSIG' },
        vessels: [{ flag: 'Indonesia' }],
      }),
    ).toThrow();
  });

  it('requires either an existing or inline client', () => {
    expect(() =>
      createPniQuotationSchema.parse({
        quotation: { insuranceTypeId: 'insurance-type-1' },
        pni: { clubCode: 'MSIG' },
      }),
    ).toThrow();
  });
});
