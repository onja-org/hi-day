import { formatHourLabel } from "@/lib/formatHourLabel";
import type { ScreenshotHighlight } from "@/types/screenshot";

type ScreenshotSlotsHighlightNoteProps = {
  highlight: ScreenshotHighlight;
};

/** Says what the ringed slots are, so the ring doesn't read as a selection. */
export function ScreenshotSlotsHighlightNote({ highlight }: ScreenshotSlotsHighlightNoteProps) {
  return (
    <p className="flex items-center gap-2 rounded-brand-sm border border-input-border bg-white p-3 text-sm text-slate-900">
      <span aria-hidden="true" className="size-3 shrink-0 rounded-full ring-2 ring-primary" />
      Highlighted: {formatHourLabel(highlight.from)} – {formatHourLabel(highlight.to)}, the stretch you came here to check.
    </p>
  );
}
