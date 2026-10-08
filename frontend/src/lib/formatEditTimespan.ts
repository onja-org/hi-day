import { formatTimeInZone } from "@/lib/timezone";

/** "Oct 5, 8:00 AM - 9:30 AM" in `zone`; an open end reads "In progress", a missing span "-". */
export function formatEditTimespan(startedAt: string | null, endedAt: string | null, zone: string): string {
  if (!startedAt) return "-";
  const day = new Intl.DateTimeFormat([], { timeZone: zone, month: "short", day: "numeric" }).format(
    new Date(startedAt),
  );
  const end = endedAt ? formatTimeInZone(endedAt, zone) : "In progress";
  return `${day}, ${formatTimeInZone(startedAt, zone)} - ${end}`;
}
