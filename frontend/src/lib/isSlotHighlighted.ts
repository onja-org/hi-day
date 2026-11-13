import type { ScreenshotHighlight, ScreenshotSlot } from "@/types/screenshot";

/** Whether a slot overlaps the highlighted stretch; both are half-open. */
export function isSlotHighlighted(slot: ScreenshotSlot, highlight: ScreenshotHighlight | null): boolean {
  if (!highlight) return false;
  return Date.parse(slot.start) < Date.parse(highlight.to) && Date.parse(slot.end) > Date.parse(highlight.from);
}
