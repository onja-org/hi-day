"use client";

import clsx from "clsx";
import Image from "next/image";
import { formatElapsed } from "@/lib/formatElapsed";
import { formatHourLabel } from "@/lib/formatHourLabel";
import { slotActivityLabel, slotWorkedMinutes } from "@/lib/slotActivityLabel";
import type { ScreenshotSlot } from "@/types/screenshot";
import { ProjectNameOrUntracked } from "./ProjectNameOrUntracked";
import { SegmentMeter } from "./SegmentMeter";

type ScreenshotSlotCellProps = {
  organisationId: string;
  slot: ScreenshotSlot;
  /** Whether activity is recorded for this member at all — the difference
   * between "nothing measured yet" and "nothing will be". */
  activityRecorded: boolean;
  /** Whether screenshots are being captured for this member at all — the
   * difference between "none was taken in this slot" and "none is being
   * taken at all". */
  screenshotsEnabled: boolean;
};

/** The span and length every state carries. */
function SlotRange({ slot }: { slot: ScreenshotSlot }) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold text-primary-dark">
        {formatHourLabel(slot.start)} – {formatHourLabel(slot.end)}
      </span>
      <span className="text-xs tabular-nums text-slate-900/50">
        {slotWorkedMinutes(slot)} min
      </span>
    </span>
  );
}

/** Named, because activity is measured per ten-minute period rather than
 * per screenshot: beside images a bare "85%" reads as belonging to the
 * nearest one. */
function ActivityReading({
  slot,
  activityRecorded,
}: {
  slot: ScreenshotSlot;
  activityRecorded: boolean;
}) {
  const label = slotActivityLabel(slot, activityRecorded);

  if (label.kind === "none") {
    return <span className="text-xs text-slate-900/50">No activity</span>;
  }
  // The timesheet's own wording, shortened to fit a quarter of a row.
  if (label.kind === "not-recorded") {
    return (
      <span
        className="text-xs text-slate-900/50"
        title="No activity was recorded for these ten minutes"
      >
        Not recorded
      </span>
    );
  }
  // Not a dash: a screenshot exists seconds after a timer starts where a
  // figure needs its whole period to close, so the first ten minutes of any
  // timer legitimately has pictures and no percentage.
  if (label.kind === "unmeasured") {
    return (
      <span
        className="text-xs text-slate-900/50 italic"
        title="Activity covers a whole ten-minute period, so this figure arrives once the period closes"
      >
        Measuring…
      </span>
    );
  }

  return (
    <span
      className="flex items-center justify-between gap-2"
      // Marked rather than spelled out — a quarter of a row cannot carry the
      // timesheet's full sentence.
      title={
        label.partial
          ? `Measured for ${formatElapsed(label.measuredSeconds * 1000)} of the ${formatElapsed(label.workedSeconds * 1000)} worked in this slot`
          : undefined
      }
    >
      <span className="text-xs text-slate-900/60">
        Activity{" "}
        <span className="font-semibold tabular-nums text-slate-900">
          {label.percentage}%
          {label.partial && <span className="text-slate-900/50">*</span>}
        </span>
      </span>
      <SegmentMeter
        fraction={label.percentage / 100}
        label={`${label.percentage}% active`}
      />
    </span>
  );
}

export function ScreenshotSlotCell({
  organisationId,
  slot,
  activityRecorded,
  screenshotsEnabled,
}: ScreenshotSlotCellProps) {
  // Nothing tracked, so nothing to say about it: a flat tile reads as
  // absence at a glance, where "No project" and "0 min" would dress one up
  // as data. Laid out like a screenshot card, with an empty frame where the
  // picture would be, so it takes up the same space as one.
  if (slot.workedSeconds <= 0) {
    return (
      <div className="flex h-full flex-col gap-2 rounded-brand-sm bg-primary-dark/5 p-3">
        <span className="text-xs text-slate-900/50">
          {formatHourLabel(slot.start)} – {formatHourLabel(slot.end)}
        </span>
        <span className="text-xs text-slate-900/50">No activity</span>
        <span className="mt-auto block aspect-video rounded-brand-sm bg-primary-dark/5" />
      </div>
    );
  }

  // Worked but unphotographed. Its own fill, so a row says which minutes
  // are missing an image before anything is read.
  if (slot.screenshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-brand-sm bg-cream px-2 py-6 text-center">
        <span className="text-xs font-semibold text-primary-dark">
          {formatHourLabel(slot.start)} – {formatHourLabel(slot.end)}
        </span>
        <span className="text-xs text-slate-900/60">No screenshot</span>
        {/* The commonest reason, and saying it beats leaving a reader to
            wonder whether the agent failed. */}
        {!screenshotsEnabled && (
          <span className="text-xs text-slate-900/50">Screenshots off</span>
        )}
        <span className="text-xs tabular-nums text-slate-900/50">
          {slotWorkedMinutes(slot)} min
        </span>
        <ActivityReading slot={slot} activityRecorded={activityRecorded} />
      </div>
    );
  }

  const several = slot.screenshots.length > 1;

  return (
    <div className="flex flex-col gap-2 rounded-brand-sm border border-input-border bg-white p-3">
      {/* Above the pictures: a card's height varies with how many it holds,
          so underneath they sat at a different height in every column. */}
      <SlotRange slot={slot} />
      <ActivityReading slot={slot} activityRecorded={activityRecorded} />
      {/* Sized here — it sets none of its own and would inherit body copy.
          Renders nothing when the organisation doesn't track Projects,
          which is why it is used rather than the slot's id directly. */}
      <span className="text-xs">
        <ProjectNameOrUntracked
          organisationId={organisationId}
          projectId={slot.projectId}
        />
      </span>

      {/* Two across once there is more than one, so a full slot stays
          roughly the height of one holding a single image. */}
      <div className={clsx("grid gap-2", several && "grid-cols-2")}>
        {slot.screenshots.map((screenshot) => (
          <figure key={screenshot.id} className="flex flex-col gap-1">
            <span className="relative block aspect-video overflow-hidden rounded-brand-sm bg-cream">
              <Image
                src={screenshot.url}
                alt={`Screenshot at ${formatHourLabel(screenshot.capturedAt)}`}
                fill
                sizes="(max-width: 768px) 25vw, 12vw"
                className="object-cover"
                unoptimized
              />
            </span>
            {/* Only worth naming when there is more than one. */}
            {several && (
              <figcaption className="text-xs tabular-nums text-slate-900/50">
                {formatHourLabel(screenshot.capturedAt)}
              </figcaption>
            )}
          </figure>
        ))}
        {slot.extraCount > 0 && (
          <span className="self-center text-xs text-slate-900/50">
            +{slot.extraCount} not shown
          </span>
        )}
      </div>
    </div>
  );
}
