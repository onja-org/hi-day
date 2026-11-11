"use client";

import { formatElapsed } from "@/lib/formatElapsed";
import { formatHourLabel } from "@/lib/formatHourLabel";
import type { ScreenshotSlotHour } from "@/types/screenshot";
import { ScreenshotSlotCell } from "./ScreenshotSlotCell";
import { SegmentMeter } from "./SegmentMeter";

/** A full hour, for the header's meter. */
const SECONDS_IN_HOUR = 3600;

type ScreenshotSlotHourSectionProps = {
  organisationId: string;
  hour: ScreenshotSlotHour;
  activityRecorded: boolean;
  screenshotsEnabled: boolean;
};

export function ScreenshotSlotHourSection({
  organisationId,
  hour,
  activityRecorded,
  screenshotsEnabled,
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
        {hour.slots.map((slot) => (
          <ScreenshotSlotCell
            key={slot.start}
            organisationId={organisationId}
            slot={slot}
            activityRecorded={activityRecorded}
            screenshotsEnabled={screenshotsEnabled}
          />
        ))}
      </div>
    </section>
  );
}
