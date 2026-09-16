import { PauseIcon } from "@phosphor-icons/react";
import { formatDuration } from "@/lib/formatDuration";
import type { PauseSpan } from "@/types/timeEntry";

type TimeEntryPauseSpansProps = {
  pauses: PauseSpan[];
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Surfaces exactly when an entry was paused and resumed — the historical
 * timesheet view otherwise only shows the net duration, with no sign a
 * pause ever happened. */
export function TimeEntryPauseSpans({ pauses }: TimeEntryPauseSpansProps) {
  if (pauses.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-0.5 pl-0.5">
      {pauses.map((pause, index) => (
        <li
          key={index}
          className="flex items-center gap-1.5 text-xs text-slate-900/60"
        >
          <PauseIcon size={12} weight="fill" aria-hidden="true" />
          {pause.resumedAt ? (
            <span>
              Paused {formatTime(pause.pausedAt)} – {formatTime(pause.resumedAt)}{" "}
              (
              {formatDuration(
                Math.round(
                  (new Date(pause.resumedAt).getTime() -
                    new Date(pause.pausedAt).getTime()) /
                    60000,
                ),
              )}
              )
            </span>
          ) : (
            <span>Paused {formatTime(pause.pausedAt)} – still paused</span>
          )}
        </li>
      ))}
    </ul>
  );
}
