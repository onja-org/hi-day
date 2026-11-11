"use client";

import { formatElapsed } from "@/lib/formatElapsed";
import type { ScreenshotSlotsDay } from "@/types/screenshot";

/** Worked time is the union across the day; activity is weighted by
 * measured time so a two-minute slot cannot swing it. */
export function ScreenshotSlotsSummary({ day }: { day: ScreenshotSlotsDay }) {
  return (
    <dl className="flex flex-wrap items-center gap-6 rounded-brand-sm border-2 border-ink bg-white px-5 py-4">
      <div className="flex flex-col">
        <dt className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
          Worked time
        </dt>
        <dd className="text-lg font-bold tabular-nums text-primary-dark">
          {formatElapsed(day.workedSeconds * 1000)}
        </dd>
      </div>
      <div className="flex flex-col">
        <dt className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
          Avg. activity
        </dt>
        {/* Never 0% for "no data". */}
        <dd className="text-lg font-bold tabular-nums text-primary-dark">
          {day.activePercentage === null ? (
            <span className="text-slate-900/40">—</span>
          ) : (
            `${day.activePercentage}%`
          )}
        </dd>
      </div>
      {!day.activityRecorded && (
        <p className="self-center text-xs text-slate-900/60">
          Record activity is off for this member, so no new activity is
          measured. Anything recorded before it was switched off still counts
          here.
        </p>
      )}
    </dl>
  );
}
