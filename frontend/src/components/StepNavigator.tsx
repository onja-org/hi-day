"use client";

import type { ReactNode } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";

type StepNavigatorProps = {
  /** Accessible names for the arrows, e.g. "Previous day" / "Next day". */
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  /** The middle segment, between the two arrows. */
  children: ReactNode;
};

/** The shared bordered ‹ [middle] › control behind `DayNavigator` and
 * `WeekNavigator` — one place for their common look, so the two can't
 * drift apart. */
export function StepNavigator({
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  nextDisabled,
  children,
}: StepNavigatorProps) {
  return (
    <div className="inline-flex h-10 items-stretch rounded-lg border border-input-border bg-white">
      <button
        type="button"
        aria-label={previousLabel}
        onClick={onPrevious}
        className="flex w-10 cursor-pointer items-center justify-center rounded-l-lg border-r border-input-border text-slate-900 transition-colors duration-150 hover:bg-cream"
      >
        <CaretLeftIcon size={16} weight="bold" aria-hidden="true" />
      </button>
      {children}
      <button
        type="button"
        aria-label={nextLabel}
        onClick={onNext}
        disabled={nextDisabled}
        className="flex w-10 cursor-pointer items-center justify-center rounded-r-lg border-l border-input-border text-slate-900 transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:text-slate-900/30 disabled:hover:bg-white"
      >
        <CaretRightIcon size={16} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}
