import type { InsightsPage } from "@/types/insights";

/** Which page the member list leads to; a missing or unknown `?page=` means the Timeline. */
export function parseInsightsPage(value: string | null): InsightsPage {
  return value === "performance" || value === "highlights" || value === "unusual-activity"
    ? value
    : "timeline";
}
