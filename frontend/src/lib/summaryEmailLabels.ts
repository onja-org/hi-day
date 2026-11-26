import type { SummaryEmailKind, SummaryFrequency } from "@/types/summaryEmails";

/** What each email is called wherever someone switches it on or off. */
export const SUMMARY_EMAIL_LABELS: Record<SummaryEmailKind, string> = {
  "personal-daily": "Daily summary of your time",
  "personal-weekly": "Weekly summary of your time",
  "team-daily": "Daily team summary",
  "team-weekly": "Weekly team summary",
};

export const SUMMARY_FREQUENCY_OPTIONS: { key: SummaryFrequency; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "both", label: "Daily & weekly" },
];
