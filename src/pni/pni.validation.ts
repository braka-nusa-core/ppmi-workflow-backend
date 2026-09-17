import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const clubFormatSchema = z.enum([
  'INIGO_SYNDICATE_1301',
  'EAGLE_OCEAN_MARINE',
  'MSIG_SPECIALTY_MARINE_NV',
]);

const jsonSchema = z.record(z.string(), z.unknown());
const identifierSchema = z.string().min(1);
const amountSchema = z.number().finite().nonnegative();

const inlineClientSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  contactPerson: z.string().optional(),
});

const quotationFieldsSchema = z.object({
  clientId: identifierSchema.optional(),
  insured: z.string().optional(),
  address: z.string().optional(),
  quotationDate: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  interest: z.string().optional(),
  rate: amountSchema.optional(),
  premium: amountSchema.optional(),
  deductible: amountSchema.optional(),
  brokerage: amountSchema.optional(),
  templateVersion: z.string().optional(),
});

const vesselSchema = z.object({
  id: identifierSchema.optional(),
  key: identifierSchema.optional(),
  name: z.string().min(1),
  imoNumber: z.string().optional(),
  vesselType: z.string().optional(),
  builtYear: z.number().int().min(1800).max(3000).optional(),
  flag: z.string().optional(),
  vesselClass: z.string().optional(),
  classNotApplicable: z.boolean().optional(),
  grossTonnage: amountSchema.optional(),
  portOfRegistry: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  details: jsonSchema.optional(),
});

const insuranceBlockSchema = z.object({
  id: identifierSchema.optional(),
  key: identifierSchema.optional(),
  inheritsFromBlockRef: identifierSchema.nullable().optional(),
  typeOfInsurance: z.string().min(1),
  security: z.string().optional(),
  policyWordingReference: z.string().optional(),
  tradingArea: z.string().optional(),
  paymentWarrantyText: z.string().optional(),
  maximumInsured: amountSchema.optional(),
  currency: z.string().length(3).optional(),
  premium: amountSchema.optional(),
  premiumBasis: z
    .enum([
      'PER_ANNUM',
      'PER_VESSEL_PER_ANNUM',
      'PRO_RATA',
      'INCLUDED_NO_ADDITIONAL_CHARGE',
      'OTHER',
    ])
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
  details: jsonSchema.optional(),
});

const vesselCoverageSchema = z.object({
  id: identifierSchema.optional(),
  vesselRef: identifierSchema,
  insuranceBlockRef: identifierSchema,
  annualPremium: amountSchema.optional(),
  limitAmount: amountSchema.optional(),
  currency: z.string().length(3).optional(),
  details: jsonSchema.optional(),
});

const provisionSchema = z.object({
  id: identifierSchema.optional(),
  insuranceBlockRef: identifierSchema.nullable().optional(),
  type: z.enum(['CONDITION', 'CLAUSE', 'EXCLUSION', 'WARRANTY']),
  source: z.enum(['PREDEFINED', 'CUSTOM']).optional(),
  scope: z.enum(['QUOTE', 'ALL_VESSELS', 'SELECTED_VESSELS']).optional(),
  title: z.string().min(1),
  content: z.string().optional(),
  reference: z.string().optional(),
  conditionRule: jsonSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  vesselRefs: z.array(identifierSchema).optional(),
});

const deductibleSchema = z.object({
  id: identifierSchema.optional(),
  insuranceBlockRef: identifierSchema,
  scope: z.enum(['FLAT', 'CLAIM_CATEGORY', 'ALL_VESSELS', 'SELECTED_VESSELS']),
  claimCategory: z.string().optional(),
  amount: amountSchema.optional(),
  currency: z.string().length(3).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  vesselRefs: z.array(identifierSchema).optional(),
});

const installmentSchema = z.object({
  id: identifierSchema.optional(),
  installmentNo: z.number().int().positive(),
  amount: amountSchema.optional(),
  currency: z.string().length(3).optional(),
  dueDate: z.string().optional(),
});

const requiredDocumentSchema = z.object({
  id: identifierSchema.optional(),
  name: z.string().min(1),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const organizationRoleSchema = z.object({
  id: identifierSchema.optional(),
  organization: z.string().optional(),
  role: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
});

const coverRestrictionSchema = z.object({
  id: identifierSchema.optional(),
  insuranceBlockRef: identifierSchema.nullable().optional(),
  name: z.string().min(1),
  partReference: z.string().optional(),
  sectionReference: z.string().optional(),
  isSelected: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const pniFieldsSchema = z.object({
  clubFormat: clubFormatSchema,
  referenceNumber: z.string().optional(),
  validityDays: z.number().int().positive().optional(),
  assuredDomicile: z.string().optional(),
  broker: z.string().optional(),
  insurerOrSecurity: z.string().optional(),
  tradingLimits: z.string().optional(),
  paymentTermsText: z.string().optional(),
  subjectivities: z.string().optional(),
  importantInformation: z.string().optional(),
  signatureName: z.string().optional(),
  signatureCity: z.string().optional(),
  signatureDate: z.string().optional(),
  details: jsonSchema.optional(),
});

const pniChildrenSchema = z.object({
  vessels: z.array(vesselSchema).optional(),
  insuranceBlocks: z.array(insuranceBlockSchema).optional(),
  vesselCoverages: z.array(vesselCoverageSchema).optional(),
  provisions: z.array(provisionSchema).optional(),
  deductibles: z.array(deductibleSchema).optional(),
  installments: z.array(installmentSchema).optional(),
  requiredDocuments: z.array(requiredDocumentSchema).optional(),
  organizationRoles: z.array(organizationRoleSchema).optional(),
  coverRestrictions: z.array(coverRestrictionSchema).optional(),
});

const removeSchema = z.object({
  vesselIds: z.array(identifierSchema).optional(),
  insuranceBlockIds: z.array(identifierSchema).optional(),
  provisionIds: z.array(identifierSchema).optional(),
  deductibleIds: z.array(identifierSchema).optional(),
  installmentIds: z.array(identifierSchema).optional(),
  requiredDocumentIds: z.array(identifierSchema).optional(),
  organizationRoleIds: z.array(identifierSchema).optional(),
  coverRestrictionIds: z.array(identifierSchema).optional(),
});

export const createPniQuotationSchema = z
  .object({
    quotation: quotationFieldsSchema.extend({
      client: inlineClientSchema.optional(),
      insuranceTypeId: identifierSchema,
    }),
    pni: pniFieldsSchema,
  })
  .merge(pniChildrenSchema)
  .refine((data) => data.quotation.clientId || data.quotation.client, {
    message: 'Either quotation.clientId or quotation.client is required',
  })
  .refine((data) => !(data.quotation.clientId && data.quotation.client), {
    message: 'Provide either quotation.clientId or quotation.client, not both',
  });

export const updatePniQuotationSchema = z
  .object({
    quotation: quotationFieldsSchema.optional(),
    pni: pniFieldsSchema.partial().optional(),
    remove: removeSchema.optional(),
  })
  .merge(pniChildrenSchema)
  .refine(
    (data) =>
      Object.keys(data).some(
        (key) => key !== 'quotation' || data.quotation !== undefined,
      ),
    { message: 'At least one update field is required' },
  );

export class CreatePniQuotationDto extends createZodDto(
  createPniQuotationSchema,
) {}

export class UpdatePniQuotationDto extends createZodDto(
  updatePniQuotationSchema,
) {}
