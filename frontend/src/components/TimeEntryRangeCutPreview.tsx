import clsx from "clsx";
import { formatClockTime } from "@/lib/formatClockTime";
import { formatElapsed } from "@/lib/formatElapsed";
import type { RangeCutPiece } from "@/lib/previewRangeCut";

type TimeEntryRangeCutPreviewProps = {
  pieces: RangeCutPiece[];
};

/** The entries a cut would leave, and the range it would drop, with how long each is. */
export function TimeEntryRangeCutPreview({ pieces }: TimeEntryRangeCutPreviewProps) {
  return (
    <ul aria-label="Result" className="flex flex-col gap-2 text-sm text-slate-900">
      {pieces.map((piece) => (
        <li
          key={piece.startedAt}
          className={clsx(
            "flex items-center justify-between rounded-md border border-input-border px-3 py-2",
            piece.removed && "border-dashed text-slate-900/50",
          )}
        >
          <span className={clsx(piece.removed && "line-through")}>
            {formatClockTime(piece.startedAt)} – {formatClockTime(piece.endedAt)}
          </span>
          <span className="tabular-nums">
            {piece.removed ? "Removed" : formatElapsed(piece.seconds * 1000)}
          </span>
        </li>
      ))}
    </ul>
  );
}
