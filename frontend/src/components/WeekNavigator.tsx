"use client";

import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { getWeekRange } from "@/lib/getWeekRange";

type WeekNavigatorProps = {
  weekOffset: number;
  onChange: (weekOffset: number) => void;
};

function formatRangeLabel(start: Date, end: Date): string {
  const startLabel = start.toLocaleDateString([], { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

/** Prev/next/"This week" navigation shared by the Weekly and Calendar tabs. */
export function WeekNavigator({ weekOffset, onChange }: WeekNavigatorProps) {
  const { start, end } = getWeekRange(new Date(), weekOffset);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous week"
        onClick={() => onChange(weekOffset - 1)}
        className="cursor-pointer rounded-md border border-input-border p-1.5 text-slate-900 hover:bg-cream"
      >
        <CaretLeftIcon size={16} aria-hidden="true" />
      </button>
      <span className="flex min-w-44 items-center justify-center gap-1.5 text-sm font-medium text-slate-900">
        <CalendarBlankIcon size={14} aria-hidden="true" className="text-slate-900/60" />
        {formatRangeLabel(start, end)}
        {weekOffset === 0 && <span className="text-primary"> · This week</span>}
      </span>
      <button
        type="button"
        aria-label="Next week"
        onClick={() => onChange(weekOffset + 1)}
        className="cursor-pointer rounded-md border border-input-border p-1.5 text-slate-900 hover:bg-cream"
      >
        <CaretRightIcon size={16} aria-hidden="true" />
      </button>
      {weekOffset !== 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-cream"
        >
          This week
        </button>
      )}
    </div>
  );
}
