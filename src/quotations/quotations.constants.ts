// Temporary conservative rule pending stakeholder confirmation in Flow V2.
export const REQUIRES_SUPERVISOR_APPROVAL_AFTER_INSURER_REVISION = true;

export const QUOTATION_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['WAITING_APPROVAL'],
  WAITING_APPROVAL: ['APPROVED', 'DRAFT'],
  APPROVED: ['SENT_TO_INSURANCE'],
  SENT_TO_INSURANCE: ['INSURANCE_APPROVED', 'REVISION'],
  REVISION: REQUIRES_SUPERVISOR_APPROVAL_AFTER_INSURER_REVISION
    ? ['WAITING_APPROVAL']
    : ['SENT_TO_INSURANCE'],
  INSURANCE_APPROVED: [],
  POLICY_ISSUED: [],
};

export function validateTransition(current: string, next: string): boolean {
  const allowed = QUOTATION_STATUS_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.includes(next);
}
