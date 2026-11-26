import type { ApiResult } from "./api";

/** How often a summary email goes out — mirrors the backend's `SUMMARY_FREQUENCIES`. */
export type SummaryFrequency = "off" | "daily" | "weekly" | "both";

/** Personal summaries are about your own time; team ones about the people you oversee. */
export type SummaryAudience = "personal" | "team";

/** One email a person can receive. */
export type SummaryEmailKind =
  | "personal-daily"
  | "personal-weekly"
  | "team-daily"
  | "team-weekly";

/** One of your own summary emails, as the backend reports it. */
export type SummaryEmailPreference = {
  kind: SummaryEmailKind;
  /** Whether your organisation's settings send it to you at all. */
  available: boolean;
  /** Whether it actually reaches you: available, and not switched off. */
  enabled: boolean;
};

export type SummaryEmailPreferencesResult = ApiResult<{
  preferences: SummaryEmailPreference[];
}>;

export type UnsubscribeSummaryEmailResult = ApiResult<{
  kind: SummaryEmailKind;
  organisationName: string;
}>;
