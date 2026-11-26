/**
 * Summary emails: a recap of tracked time sent the morning after a day or a
 * week ends. "Personal" goes to every member about their own time; "team"
 * goes to admins and team managers about the people they oversee.
 *
 * Each has an Organisation default and a per-member override set by an
 * admin, both a frequency. On top of that, each person can switch off any
 * of the emails that reach them — an opt-out only: a member can't turn on
 * what an admin turned off for them.
 */
export const SUMMARY_FREQUENCIES = ['off', 'daily', 'weekly', 'both'] as const;
export type SummaryFrequency = (typeof SUMMARY_FREQUENCIES)[number];

export type SummaryAudience = 'personal' | 'team';
export type SummaryPeriod = 'daily' | 'weekly';

/** One email a person can receive — also what an opt-out names. */
export const SUMMARY_EMAIL_KINDS = [
  'personal-daily',
  'personal-weekly',
  'team-daily',
  'team-weekly',
] as const;
export type SummaryEmailKind = (typeof SUMMARY_EMAIL_KINDS)[number];

/** Weekly is useful without crowding anyone's inbox; daily is opt-in. */
export const DEFAULT_SUMMARY_FREQUENCY: SummaryFrequency = 'weekly';

export function summaryKind(
  audience: SummaryAudience,
  period: SummaryPeriod,
): SummaryEmailKind {
  return `${audience}-${period}`;
}

export function parseSummaryKind(kind: SummaryEmailKind): {
  audience: SummaryAudience;
  period: SummaryPeriod;
} {
  const [audience, period] = kind.split('-') as [
    SummaryAudience,
    SummaryPeriod,
  ];
  return { audience, period };
}

/** The member's override when an admin set one, else the Organisation's. */
export function resolveSummaryFrequency(
  organisationDefault: SummaryFrequency | undefined,
  membershipOverride: SummaryFrequency | null | undefined,
): SummaryFrequency {
  return membershipOverride ?? organisationDefault ?? DEFAULT_SUMMARY_FREQUENCY;
}

export function frequencyIncludes(
  frequency: SummaryFrequency,
  period: SummaryPeriod,
): boolean {
  return frequency === 'both' || frequency === period;
}

/**
 * Whether one person gets one summary email: the admin's choice for them
 * (their override, else the default) includes it, and they haven't
 * switched it off themselves. Whether they may get a *team* summary at all
 * — admins and team managers only — is the caller's to decide.
 */
export function summaryEmailEnabled(
  kind: SummaryEmailKind,
  input: {
    organisationDefault: SummaryFrequency | undefined;
    membershipOverride: SummaryFrequency | null | undefined;
    optOuts: readonly SummaryEmailKind[] | null | undefined;
  },
): boolean {
  const { period } = parseSummaryKind(kind);
  const frequency = resolveSummaryFrequency(
    input.organisationDefault,
    input.membershipOverride,
  );
  return (
    frequencyIncludes(frequency, period) &&
    !(input.optOuts ?? []).includes(kind)
  );
}
