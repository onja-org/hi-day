import { keyAsLocalDate } from "@/lib/timezone";

/** "2026-09-28" → "Mon, Sep 28, 2026" in the viewer's locale. */
export function formatReportDay(dateKey: string): string {
  return keyAsLocalDate(dateKey).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
