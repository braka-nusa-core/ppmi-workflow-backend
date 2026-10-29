import { createHash } from 'crypto';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function normalizePolicyNumber(policyNumber: string) {
  return policyNumber
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^NO\.?/, '')
    .replace(/\*/g, '-')
    .replace(/(?<=\d)O(?=\d)/g, '0')
    .replace(/[/-]+$/, '');
}

export function normalizeClubCode(clubCode: string) {
  return clubCode.trim().toUpperCase();
}

export function vesselIdentityKey(
  normalizedName: string,
  builtYear: number | null | undefined,
  grossTonnage: string | number | null | undefined,
) {
  const grt =
    grossTonnage === null || grossTonnage === undefined
      ? ''
      : Number(grossTonnage).toFixed(2);
  return sha256(`${normalizedName}|${builtYear ?? ''}|${grt}`);
}

export function vesselPolicyCoverageKey(
  vesselId: string,
  policyNumber: string | null,
  periodStart: Date | null,
) {
  return sha256(
    `${vesselId}|${policyNumber ?? ''}|${periodStart ? periodStart.toISOString() : ''}`,
  );
}
