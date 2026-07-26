export const QUOTATION_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['WAITING_APPROVAL'],
  WAITING_APPROVAL: ['APPROVED', 'DRAFT'],
  APPROVED: ['SENT_TO_INSURANCE'],
  SENT_TO_INSURANCE: ['POLICY_ISSUED', 'REVISION'],
  REVISION: ['SENT_TO_INSURANCE'],
  POLICY_ISSUED: [],
};

export function validateTransition(
  current: string,
  next: string,
): boolean {
  const allowed = QUOTATION_STATUS_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.includes(next);
}
