"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { isAfter, isSameDay, isSameMonth, isWithinInterval } from "date-fns";
import { useOrganisationWeekStart } from "@/hooks/useOrganisationWeekStart";
import { buildMonthGrid } from "@/lib/buildMonthGrid";
import type { DateRange } from "@/types/dateRange";

const MONDAY_FIRST_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const SUNDAY_FIRST_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type MonthCalendarProps = {
  month: Date;
  selection: DateRange;
  today: Date;
  /** Shown under the grid — `DateRangePicker` uses it for one end of the range. */
  footerDate?: Date;
  onSelectDay: (day: Date) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
};

/** One month panel shared by `DateRangePicker` and `DatePicker`: header
 * with optional prev/next arrows, a day grid starting on the organisation's
 * week-start day and highlighting the selected range (a single day is a
 * range with from = to), and an optional footer date. Days outside the month
 * or after today aren't selectable — there's no tracked time in the future. */
export function MonthCalendar({
  month,
  selection,
  today,
  footerDate,
  onSelectDay,
  onPrevious,
  onNext,
  nextDisabled,
}: MonthCalendarProps) {
  const weekStart = useOrganisationWeekStart();
  const monthLabel = month.toLocaleDateString([], { month: "short", year: "numeric" });
  const weekdayLabels =
    weekStart === "sunday" ? SUNDAY_FIRST_LABELS : MONDAY_FIRST_LABELS;

  return (
    <section aria-label={monthLabel} className="flex w-72 flex-col">
      <header className="flex items-center justify-between bg-primary px-2 py-3 text-white">
        {onPrevious ? (
          <button
            type="button"
            aria-label="Previous month"
            onClick={onPrevious}
            className="cursor-pointer rounded-md p-1 hover:bg-white/20"
          >
            <CaretLeftIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        ) : (
          <span className="w-6" />
        )}
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
        {onNext ? (
          <button
            type="button"
            aria-label="Next month"
            onClick={onNext}
            disabled={nextDisabled}
            className="cursor-pointer rounded-md p-1 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <CaretRightIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        ) : (
          <span className="w-6" />
        )}
      </header>

      <div className="grid grid-cols-7 bg-primary/10 text-center text-sm font-medium text-primary">
        {weekdayLabels.map((label) => (
          <span key={label} className="py-2">
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 p-1 text-center text-sm">
        {buildMonthGrid(month, weekStart).map((day) => {
          const disabled = !isSameMonth(day, month) || isAfter(day, today);
          const isEndpoint = isSameDay(day, selection.from) || isSameDay(day, selection.to);
          const inRange = isWithinInterval(day, { start: selection.from, end: selection.to });

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              aria-pressed={!disabled && inRange}
              aria-label={day.toLocaleDateString([], { dateStyle: "full" })}
              onClick={() => onSelectDay(day)}
              className={clsx(
                "h-9 cursor-pointer rounded-md transition-colors duration-150 disabled:cursor-not-allowed",
                disabled && "text-slate-900/30",
                !disabled && isEndpoint && "bg-primary font-semibold text-white",
                !disabled && !isEndpoint && inRange && "bg-primary/15 text-primary-dark",
                !disabled && !inRange && "text-slate-900 hover:bg-cream",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {footerDate && (
        <p className="mt-auto border-t border-input-border bg-primary/5 py-2 text-center text-xs font-medium text-slate-900">
          {footerDate.toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}
    </section>
  );
}
