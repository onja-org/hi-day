/** How long dismissing the desktop-app prompt keeps it hidden. */
export const DESKTOP_APP_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether a dismissal stored as `raw` (epoch milliseconds) still hides the
 * prompt at `now`. Nothing stored, or anything that isn't a number, counts
 * as never dismissed.
 */
export function isDesktopAppPromptSnoozed(raw: string | null, now: number): boolean {
  if (raw === null) return false;
  const dismissedAt = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(dismissedAt)) return false;
  return now - dismissedAt < DESKTOP_APP_PROMPT_SNOOZE_MS;
}
