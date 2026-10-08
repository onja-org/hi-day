import { formatElapsed } from "@/lib/formatElapsed";

/** A signed duration like "+01:30:00" or "-00:45:00"; no change reads "00:00:00". */
export function formatTimeChange(seconds: number): string {
  const elapsed = formatElapsed(Math.abs(seconds) * 1000);
  if (seconds > 0) return `+${elapsed}`;
  if (seconds < 0) return `-${elapsed}`;
  return elapsed;
}
