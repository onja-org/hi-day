"use client";

import { useState } from "react";
import { ClockIcon } from "@phosphor-icons/react";
import type { ReportSchedule, ScheduleReportInput } from "@/types/reportSchedule";
import { ScheduleReportModal } from "./ScheduleReportModal";

type ScheduleReportButtonProps = {
  /** Prefill when the report being viewed is already saved and scheduled. */
  initialName?: string;
  initialSchedule?: ReportSchedule;
  onSchedule: (input: ScheduleReportInput) => void;
};

/** An icon button that opens the schedule-report modal and closes it once scheduled. */
export function ScheduleReportButton({ initialName, initialSchedule, onSchedule }: ScheduleReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Schedule report"
        title="Schedule report delivery"
        onClick={() => setOpen(true)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-md border border-input-border text-primary transition-colors duration-150 hover:border-primary"
      >
        <ClockIcon size={16} aria-hidden="true" />
      </button>
      {open && (
        <ScheduleReportModal
          initialName={initialName}
          initialSchedule={initialSchedule}
          onClose={() => setOpen(false)}
          onSchedule={(input) => {
            onSchedule(input);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
