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
  // Reached only through the policy module (POST /quotations/:id/issue-policy).
  INSURANCE_APPROVED: ['POLICY_ISSUED'],
  POLICY_ISSUED: [],
};

// Provisional: the business has not fixed which events start a new terms
// version. Today a snapshot is taken when a quotation is submitted for internal
// approval and when it is sent to the insurer. Adjust here once confirmed.
export const TERM_VERSION_TRIGGERS: Record<string, string> = {
  WAITING_APPROVAL: 'SUBMIT',
  SENT_TO_INSURANCE: 'SEND_TO_INSURANCE',
};

export function validateTransition(current: string, next: string): boolean {
  const allowed = QUOTATION_STATUS_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.includes(next);
}
