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

function pauseTitle(pause: PauseSpan): string {
  if (!pause.resumedAt) {
    return `Paused ${formatTime(pause.pausedAt)} – still paused`;
  }
  return `Paused ${formatTime(pause.pausedAt)} – ${formatTime(pause.resumedAt)}`;
}

/** Surfaces that an entry was paused — the historical timesheet view
 * otherwise only shows the net duration, with no sign a pause ever
 * happened. Each pause is a compact badge (exact start/end times are
 * still available on hover, via the badge's title) rather than a
 * full sentence per pause, so a row with several short pauses stays scannable. */
export function TimeEntryPauseSpans({ pauses }: TimeEntryPauseSpansProps) {
  if (pauses.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 pl-0.5">
      {pauses.map((pause, index) => (
        <span
          key={index}
          title={pauseTitle(pause)}
          className="inline-flex items-center gap-1 rounded-full bg-sidebar px-2 py-0.5 text-xs text-slate-900/70"
        >
          <PauseIcon size={10} weight="fill" aria-hidden="true" />
          {pause.resumedAt
            ? `paused ${formatDuration(
                Math.round(
                  (new Date(pause.resumedAt).getTime() -
                    new Date(pause.pausedAt).getTime()) /
                    60000,
                ),
              )}`
            : "still paused"}
        </span>
      ))}
    </div>
  );
}
