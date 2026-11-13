import { keyAsLocalDate } from "@/lib/timezone";

function formatDay(dateKey: string): string {
  return keyAsLocalDate(dateKey).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "2026-10-12", "2026-11-01" → "Oct 12 – Nov 1"; a single day is just "Nov 1". */
export function formatDayRange(from: string, to: string): string {
  return from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;
}
