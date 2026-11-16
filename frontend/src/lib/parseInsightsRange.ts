import type { DateRangePreset } from "@/types/dateRange";

const PRESETS: readonly DateRangePreset[] = [
  "today",
  "yesterday",
  "this_week",
  "last_7_days",
  "last_week",
  "last_2_weeks",
  "this_month",
  "last_month",
];

export const DEFAULT_INSIGHTS_PRESET: DateRangePreset = "last_7_days";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type InsightsRangeParams = {
  preset: string | null;
  from: string | null;
  to: string | null;
};

export type InsightsRangeChoice =
  | { preset: DateRangePreset; days: null }
  | { preset: null; days: { from: string; to: string } };

/**
 * The date range an Insights URL asks for: a valid `from`/`to` pair wins,
 * then a known `preset`, then the default. Anything malformed falls back
 * rather than erroring, since it came from a hand-edited or stale link.
 */
export function parseInsightsRange(params: InsightsRangeParams): InsightsRangeChoice {
  const { from, to } = params;
  if (from && to && DATE_KEY.test(from) && DATE_KEY.test(to) && from <= to) {
    return { preset: null, days: { from, to } };
  }
  const preset = PRESETS.find((candidate) => candidate === params.preset);
  return { preset: preset ?? DEFAULT_INSIGHTS_PRESET, days: null };
}
