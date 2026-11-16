import { ArrowsOutCardinalIcon, CursorClickIcon, KeyboardIcon } from "@phosphor-icons/react";
import { formatCompactCount } from "@/lib/formatCompactCount";
import type { InputCounts } from "@/types/inputCounts";

type InputCountsLineProps = {
  /** Null or absent is "not available", never zeros. */
  counts: InputCounts | null | undefined;
};

/**
 * Keystrokes, clicks and pointer travel on one short line, beside an
 * activity %. Counts only — the line never says which keys or where.
 */
export function InputCountsLine({ counts }: InputCountsLineProps) {
  if (!counts) {
    return (
      <span
        className="text-xs text-slate-900/50"
        title="Keystroke, click and mouse-movement counts couldn't be collected on this computer"
      >
        Counts not available
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-slate-900/70">
      <span className="flex items-center gap-1" title={`${counts.keystrokes} keystrokes`}>
        <KeyboardIcon size={14} aria-hidden="true" />
        <span className="sr-only">Keystrokes:</span>
        {formatCompactCount(counts.keystrokes)}
      </span>
      <span className="flex items-center gap-1" title={`${counts.mouseClicks} mouse clicks`}>
        <CursorClickIcon size={14} aria-hidden="true" />
        <span className="sr-only">Mouse clicks:</span>
        {formatCompactCount(counts.mouseClicks)}
      </span>
      <span
        className="flex items-center gap-1"
        title={`The mouse moved ${counts.mouseMovement} pixels`}
      >
        <ArrowsOutCardinalIcon size={14} aria-hidden="true" />
        <span className="sr-only">Mouse movement:</span>
        {formatCompactCount(counts.mouseMovement)} px
      </span>
    </span>
  );
}
