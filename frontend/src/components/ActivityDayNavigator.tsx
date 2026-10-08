"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { getDayRange } from "@/lib/getDayRange";

type ActivityDayNavigatorProps = {
  dayOffset: number;
  onChange: (dayOffset: number) => void;
};

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Prev/next/"Today" day navigation for the Apps/URLs/Screenshots/Notes
 * activity pages — deliberately not a calendar-icon popup picker (no such
 * widget exists anywhere in this codebase yet, and building one is a much
 * larger, separate addition than this redesign calls for). Modeled on
 * WeekNavigator's shape, one day at a time instead of one week. */
export function ActivityDayNavigator({ dayOffset, onChange }: ActivityDayNavigatorProps) {
  const { start } = getDayRange(new Date(), dayOffset);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onChange(dayOffset - 1)}
        className="cursor-pointer rounded-brand-sm border-2 border-ink p-1.5 text-slate-900 hover:bg-cream font-semibold"
      >
        <CaretLeftIcon size={16} aria-hidden="true" />
      </button>
      <span className="min-w-40 text-center text-sm font-medium text-slate-900">
        {formatDayLabel(start)}
      </span>
      <button
        type="button"
        aria-label="Next day"
        onClick={() => onChange(dayOffset + 1)}
        className="cursor-pointer rounded-brand-sm border-2 border-ink p-1.5 text-slate-900 hover:bg-cream font-semibold"
      >
        <CaretRightIcon size={16} aria-hidden="true" />
      </button>
      {dayOffset !== 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-cream"
        >
          Today
        </button>
      )}
    </div>
  );
}
