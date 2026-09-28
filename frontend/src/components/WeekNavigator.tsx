"use client";

import { CalendarBlankIcon } from "@phosphor-icons/react";
import { getWeekRange } from "@/lib/getWeekRange";
import { StepNavigator } from "./StepNavigator";

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
    <div className="flex flex-wrap items-center gap-2">
      <StepNavigator
        previousLabel="Previous week"
        nextLabel="Next week"
        onPrevious={() => onChange(weekOffset - 1)}
        onNext={() => onChange(weekOffset + 1)}
      >
        <span className="flex items-center gap-2 px-4 text-sm text-slate-900">
          <CalendarBlankIcon size={18} aria-hidden="true" className="text-primary" />
          <span className="font-semibold">{formatRangeLabel(start, end)}</span>
          {weekOffset === 0 && <span className="text-xs text-slate-900/60">This week</span>}
        </span>
      </StepNavigator>
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
