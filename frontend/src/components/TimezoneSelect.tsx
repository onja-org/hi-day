"use client";

import { useRef, useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useDismissOnOutside } from "@/hooks/useDismissOnOutside";
import { describeTimezone, timezoneAbbreviation } from "@/lib/timezone";
import type { TimezoneSource } from "@/lib/timezone";

export type TimezoneOption = {
  source: TimezoneSource;
  /** "Member's time zone", "My time zone", or the organisation's name. */
  heading: string;
  /** Null when nobody has reported one for that person yet. */
  zone: string | null;
};

type TimezoneSelectProps = {
  options: TimezoneOption[];
  value: TimezoneSource;
  onChange: (source: TimezoneSource) => void;
};

/**
 * Chooses which timezone the timesheet is read in — entries never move,
 * only the clock they are shown against.
 *
 * Three choices rather than a full IANA list: the only days worth
 * reconstructing are the viewed member's, your own, and the organisation's.
 */
export function TimezoneSelect({ options, value, onChange }: TimezoneSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(isOpen, [containerRef], () => setIsOpen(false));

  const selected = options.find((option) => option.source === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Time zone to read this in"
        className="flex cursor-pointer items-center gap-1.5 rounded-brand-sm border-2 border-ink bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:border-primary hover:text-primary"
      >
        {selected?.zone ? timezoneAbbreviation(selected.zone) : "Time zone"}
        <CaretDownIcon size={12} aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute top-full right-0 z-20 mt-1 w-72 rounded-brand-sm border-2 border-ink bg-white py-1 shadow-hard-sm"
        >
          {options.map((option) => {
            // No zone recorded — saying so beats showing their hours on
            // someone else's clock.
            const unavailable = option.zone === null;
            return (
              <li key={option.source}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.source === value}
                  disabled={unavailable}
                  onClick={() => {
                    onChange(option.source);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    "flex w-full flex-col items-start px-3 py-2 text-left",
                    unavailable
                      ? "cursor-not-allowed"
                      : "cursor-pointer hover:bg-cream",
                    option.source === value && !unavailable && "bg-cream",
                  )}
                >
                  <span className="text-xs text-slate-900/60">
                    {option.heading}
                  </span>
                  <span
                    className={clsx(
                      "text-sm",
                      unavailable ? "text-slate-900/40" : "text-slate-900",
                    )}
                  >
                    {option.zone
                      ? describeTimezone(option.zone)
                      : "Not recorded yet"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
