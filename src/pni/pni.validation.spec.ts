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

  it('requires either an existing or inline client', () => {
    expect(() =>
      createPniQuotationSchema.parse({
        quotation: { insuranceTypeId: 'insurance-type-1' },
        pni: { clubCode: 'MSIG' },
      }),
    ).toThrow();
  });
});
