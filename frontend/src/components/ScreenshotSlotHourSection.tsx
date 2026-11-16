"use client";

import clsx from "clsx";
import { formatElapsed } from "@/lib/formatElapsed";
import { formatHourLabel } from "@/lib/formatHourLabel";
import { isSlotHighlighted } from "@/lib/isSlotHighlighted";
import type { ScreenshotHighlight, ScreenshotSlotHour } from "@/types/screenshot";
import { ScreenshotSlotCell } from "./ScreenshotSlotCell";
import { SegmentMeter } from "./SegmentMeter";

/** A full hour, for the header's meter. */
const SECONDS_IN_HOUR = 3600;

type ScreenshotSlotHourSectionProps = {
  organisationId: string;
  hour: ScreenshotSlotHour;
  activityRecorded: boolean;
  screenshotsEnabled: boolean;
  /** A stretch to point out — its slots get a ring. */
  highlight: ScreenshotHighlight | null;
};

export function ScreenshotSlotHourSection({
  organisationId,
  hour,
  activityRecorded,
  screenshotsEnabled,
  highlight,
}: ScreenshotSlotHourSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3 border-b border-input-border pb-2">
        <h3 className="text-base font-bold text-primary-dark">
          {formatHourLabel(hour.start)}
        </h3>
        <span className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-slate-900/60">
            {formatElapsed(hour.workedSeconds * 1000)} worked
          </span>
          <SegmentMeter
            fraction={hour.workedSeconds / SECONDS_IN_HOUR}
            label={`${formatElapsed(hour.workedSeconds * 1000)} of the hour worked`}
          />
        </span>
      </header>
      {/* At most four across so each screenshot stays large enough to
          read. Cells stretch to their row's height, so an empty slot is
          the same size as a screenshot card beside it. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {hour.slots.map((slot) => {
          const highlighted = isSlotHighlighted(slot, highlight);
          // A one-cell grid, so the cell still stretches to its row's height.
          return (
            <div
              key={slot.start}
              data-highlighted={highlighted || undefined}
              className={clsx("grid rounded-brand-sm", highlighted && "ring-2 ring-primary ring-offset-2")}
            >
              <ScreenshotSlotCell
                organisationId={organisationId}
                slot={slot}
                activityRecorded={activityRecorded}
                screenshotsEnabled={screenshotsEnabled}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
