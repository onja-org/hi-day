"use client";

import { useCallback, useRef, useState } from "react";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import {
  addMonths,
  endOfDay,
  isBefore,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { useDismissOnOutsideClick } from "@/hooks/useDismissOnOutsideClick";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import { selectRangeDay } from "@/lib/selectRangeDay";
import type {
  DateRange,
  DateRangePreset,
  RangeSelection,
} from "@/types/dateRange";
import { DateRangePresetList } from "@/components/DateRangePresetList";
import { Label } from "@/components/ui/form/Label";
import { MonthCalendar } from "@/components/MonthCalendar";

type DateRangePickerProps = {
  id: string;
  label: string;
  value: DateRange;
  /** null when `value` is a custom calendar selection rather than a preset. */
  preset: DateRangePreset | null;
  defaultPreset: DateRangePreset;
  onChange: (range: DateRange, preset: DateRangePreset | null) => void;
};

function formatDay(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** A trigger showing the applied range, opening a popover with quick
 * presets and a two-month calendar. Picks stay a draft until Apply —
 * Cancel, Escape, or clicking outside discard them. Follows the same
 * click-outside-to-close behaviour as `MultiSelectDropdown`. */
export function DateRangePicker({
  id,
  label,
  value,
  preset,
  defaultPreset,
  onChange,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RangeSelection>({
    ...value,
    pickingEnd: false,
  });
  const [draftPreset, setDraftPreset] = useState<DateRangePreset | null>(
    preset,
  );
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value.from));
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismissOnOutsideClick(containerRef, open, close);

  const today = startOfDay(new Date());
  const currentMonth = startOfMonth(today);

  function showRange(range: DateRange) {
    setDraft({ ...range, pickingEnd: false });
    // Never page past the current month — everything after it is disabled.
    const fromMonth = startOfMonth(range.from);
    setViewMonth(isBefore(fromMonth, currentMonth) ? fromMonth : currentMonth);
  }

  function openPopover() {
    showRange(value);
    setDraftPreset(preset);
    setOpen(true);
  }

  function selectPreset(next: DateRangePreset) {
    showRange(getTimesheetDateRange(next));
    setDraftPreset(next);
  }

  function selectDay(day: Date) {
    setDraft((current) => selectRangeDay(current, day));
    setDraftPreset(null);
  }

  function apply() {
    onChange(
      { from: startOfDay(draft.from), to: endOfDay(draft.to) },
      draftPreset,
    );
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? close() : openPopover())}
          className={clsx(
            "flex h-11 cursor-pointer items-center gap-3 rounded-md border-2 bg-white px-3 text-sm text-slate-900 transition-colors duration-150",
            open && "border-primary/50",
            !open && "border-input-border hover:border-primary/50",
          )}
        >
          {formatDay(value.from)} - {formatDay(value.to)}
          <CalendarBlankIcon
            size={18}
            aria-hidden="true"
            className="text-primary"
          />
        </button>

        {preset !== defaultPreset && (
          <button
            type="button"
            onClick={() =>
              onChange(getTimesheetDateRange(defaultPreset), defaultPreset)
            }
            className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-cream"
          >
            Reset
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date range"
          className="absolute top-full left-0 z-20 mt-2 flex flex-col overflow-hidden rounded-md border border-input-border bg-white shadow-lg sm:flex-row"
        >
          <div className="flex flex-col gap-4 p-3 sm:w-44">
            <DateRangePresetList value={draftPreset} onSelect={selectPreset} />
            <div className="mt-auto grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={apply}
                className="cursor-pointer rounded-md bg-primary px-3 h-11 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary/90"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={close}
                className="cursor-pointer rounded-md border border-input-border px-3 h-11 text-sm font-medium text-slate-900 hover:bg-cream"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="flex flex-col border-t border-input-border md:flex-row sm:border-t-0 sm:border-l">
            <MonthCalendar
              month={viewMonth}
              selection={draft}
              today={today}
              footerDate={draft.from}
              onSelectDay={selectDay}
              onPrevious={() => setViewMonth((month) => subMonths(month, 1))}
            />
            <div className="border-t border-input-border md:border-t-0 md:border-l">
              <MonthCalendar
                month={addMonths(viewMonth, 1)}
                selection={draft}
                today={today}
                footerDate={draft.to}
                onSelectDay={selectDay}
                onNext={() => setViewMonth((month) => addMonths(month, 1))}
                nextDisabled={!isBefore(viewMonth, currentMonth)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
