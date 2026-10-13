"use client";

import { CalendarBlankIcon } from "@phosphor-icons/react";
import { useOrganisationWeekStart } from "@/hooks/useOrganisationWeekStart";
import { getWeekRange } from "@/lib/getWeekRange";
import { Label } from "@/components/ui/form/Label";
import { StepNavigator } from "@/components/StepNavigator";

type WeekNavigatorProps = {
  weekOffset: number;
  onChange: (weekOffset: number) => void;
  label: string;
  /** The week shown is the week in this zone, matching the entries below
   * it — a week boundary falls at a different instant in each. */
  zone: string;
};

function formatRangeLabel(start: Date, end: Date, zone: string): string {
  const format = { month: "short", day: "numeric", timeZone: zone } as const;
  return `${start.toLocaleDateString([], format)} – ${end.toLocaleDateString([], format)}`;
}

export function WeekNavigator({
  weekOffset,
  onChange,
  label,
  zone,
}: WeekNavigatorProps) {
  const { start, end } = getWeekRange(
    new Date(),
    weekOffset,
    zone,
    useOrganisationWeekStart(),
  );

  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <StepNavigator
          previousLabel="Previous week"
          nextLabel="Next week"
          onPrevious={() => onChange(weekOffset - 1)}
          onNext={() => onChange(weekOffset + 1)}
          // There's no tracked time in a future week.
          nextDisabled={weekOffset >= 0}
        >
          <span className="flex items-center gap-2 px-4 text-sm text-slate-900">
            <CalendarBlankIcon
              size={18}
              aria-hidden="true"
              className="text-primary"
            />
            <span className="font-semibold">
              {formatRangeLabel(start, end, zone)}
            </span>
            {weekOffset === 0 && (
              <span className="text-xs text-slate-900/60">This week</span>
            )}
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
    </div>
  );
}
