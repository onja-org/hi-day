import type { ScreenshotHighlight } from "@/types/screenshot";

/** The query keys a link to a moment sets on the Screenshots page. */
export const SCREENSHOT_HIGHLIGHT_KEYS = ["highlightFrom", "highlightTo"] as const;

/**
 * The stretch a link asked the Screenshots page to point out, e.g. an
 * Unusual activity instance. `null` unless both ends are valid instants
 * with the start first, so a hand-edited URL just shows the plain day.
 */
export function parseScreenshotHighlight(searchParams: URLSearchParams): ScreenshotHighlight | null {
  const [fromKey, toKey] = SCREENSHOT_HIGHLIGHT_KEYS;
  const from = searchParams.get(fromKey);
  const to = searchParams.get(toKey);
  if (!from || !to) return null;

  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end) || start >= end) return null;
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}
