"use client";

import { HourglassIcon } from "@phosphor-icons/react";
import { formatElapsed } from "@/lib/formatElapsed";

type WorkTimeLimitReachedModalProps = {
  kind: "daily" | "weekly";
  limitHours: number;
  onClose: () => void;
};

/**
 * Shown once, on the poll that ended the timer. Informational rather than
 * an error: nothing went wrong, a limit the admin set was reached.
 */
export function WorkTimeLimitReachedModal({
  kind,
  limitHours,
  onClose,
}: WorkTimeLimitReachedModalProps) {
  const period = kind === "daily" ? "today" : "this week";
  const resets = kind === "daily" ? "tomorrow" : "when the week resets";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-time-limit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-brand border-3 border-ink bg-white p-6 shadow-hard">
        <span className="flex size-12 items-center justify-center rounded-full bg-cream">
          <HourglassIcon size={24} aria-hidden="true" className="text-primary" />
        </span>

        <h2
          id="work-time-limit-title"
          className="text-lg font-semibold text-primary-dark"
        >
          Your timer has stopped
        </h2>
        <p className="text-sm text-slate-900">
          You have tracked the {formatElapsed(limitHours * 3600 * 1000)} your
          organisation allows {period}, so your timer was stopped. The time you
          tracked is saved. You can track again {resets}.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="h-11 cursor-pointer self-end rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white transition-colors duration-150 hover:bg-primary/90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
