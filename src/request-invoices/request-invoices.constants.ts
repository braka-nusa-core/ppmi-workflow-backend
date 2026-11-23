export const REQUEST_INVOICE_DOCUMENT_TYPES = [
  'POLICY_DOCUMENT',
  'SIGNED_QS',
  'CN_DN',
  'RENEWAL_ATTACHMENT',
  'OTHER',
] as const;

export type RequestInvoiceDocumentTypeValue =
  (typeof REQUEST_INVOICE_DOCUMENT_TYPES)[number];

/** Must all be uploaded before an RFI can be submitted. */
export const REQUIRED_DOCUMENT_TYPES: RequestInvoiceDocumentTypeValue[] = [
  'POLICY_DOCUMENT',
  'SIGNED_QS',
  'CN_DN',
];

/** Technical may edit the RFI and its documents only in these statuses. */
export const EDITABLE_STATUSES = ['DRAFT', 'RETURNED_TO_TECHNICAL'];

export const REQUEST_INVOICE_STATUSES = [
  'DRAFT',
  'RFI_SUBMITTED',
  'RETURNED_TO_TECHNICAL',
  'READY_FOR_INVOICE',
] as const;
