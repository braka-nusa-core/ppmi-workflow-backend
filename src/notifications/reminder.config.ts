export type ReminderType =
  | 'VESSEL_DOCUMENT_EXPIRING'
  | 'VESSEL_SURVEY_EXPIRING'
  | 'INSTALLMENT_DUE'
  | 'FOLLOW_UP_DUE';

// Provisional: the business has only agreed "7 days before a deadline" as an
// example. Each type can be overridden with REMINDER_DAYS_<TYPE> (for example
// REMINDER_DAYS_INSTALLMENT_DUE=14), or all at once with REMINDER_DAYS_BEFORE.
export const DEFAULT_REMINDER_DAYS = 7;

export function getReminderDays(
  type: ReminderType,
  env: NodeJS.ProcessEnv = process.env,
) {
  for (const raw of [env[`REMINDER_DAYS_${type}`], env.REMINDER_DAYS_BEFORE]) {
    const days = Number(raw);
    if (
      raw !== undefined &&
      raw !== '' &&
      Number.isInteger(days) &&
      days >= 0
    ) {
      return days;
    }
  }
  return DEFAULT_REMINDER_DAYS;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Window [start of today, end of day N days ahead], in UTC. */
export function reminderWindow(now: Date, days: number) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(start.getTime() + (days + 1) * DAY_MS - 1);
  return { start, end };
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
