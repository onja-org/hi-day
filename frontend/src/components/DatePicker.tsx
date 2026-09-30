"use client";

import { useCallback, useRef, useState } from "react";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import {
  addMonths,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { useDismissOnOutsideClick } from "@/hooks/useDismissOnOutsideClick";
import { MonthCalendar } from "@/components/MonthCalendar";

type DatePickerProps = {
  value: Date;
  onChange: (date: Date) => void;
  label: string;
  embedded?: boolean;
};

export function DatePicker({
  value,
  onChange,
  label,
  embedded = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value));
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismissOnOutsideClick(containerRef, open, close);

  const today = startOfDay(new Date());
  const selectedDay = startOfDay(value);
  const isToday = isSameDay(selectedDay, today);

  function toggle() {
    if (!open) setViewMonth(startOfMonth(value));
    setOpen(!open);
  }

  function select(day: Date) {
    onChange(day);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`${label}: ${value.toLocaleDateString([], { dateStyle: "full" })}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className={clsx(
          "flex h-10 cursor-pointer items-center text-sm text-slate-900 transition-colors duration-150",
          !embedded &&
            "w-64 justify-between gap-3 rounded-md border bg-white px-3",
          !embedded && open && "border-primary",
          !embedded && !open && "border-input-border hover:border-primary/50",
          embedded && "gap-2 px-4 hover:bg-cream",
          embedded && open && "bg-cream",
        )}
      >
        {embedded ? (
          <>
            <CalendarBlankIcon
              size={18}
              aria-hidden="true"
              className="text-primary"
            />
            <span className="font-semibold">
              {value.toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            {isToday && (
              <span className="text-xs text-slate-900/60">Today</span>
            )}
          </>
        ) : (
          <>
            {value.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            <CalendarBlankIcon
              size={18}
              aria-hidden="true"
              className="text-primary"
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={clsx(
            "absolute top-full z-20 mt-2 overflow-hidden rounded-md border border-input-border bg-white shadow-lg",
            embedded && "left-1/2 -translate-x-1/2",
            !embedded && "left-0",
          )}
        >
          <MonthCalendar
            month={viewMonth}
            selection={{ from: selectedDay, to: selectedDay }}
            today={today}
            onSelectDay={select}
            onPrevious={() => setViewMonth((month) => subMonths(month, 1))}
            onNext={() => setViewMonth((month) => addMonths(month, 1))}
            nextDisabled={!isBefore(viewMonth, startOfMonth(today))}
          />
          <div className="flex justify-end border-t border-input-border p-2">
            <button
              type="button"
              onClick={() => select(today)}
              className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-cream"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
