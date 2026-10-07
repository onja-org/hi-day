"use client";

import { useModalSubmit } from "@/hooks/useModalSubmit";
import type { ReportSchedule } from "@/types/reportSchedule";
import { ScheduleReportModal } from "./ScheduleReportModal";

type ScheduleReportDialogProps = {
  initialName: string;
  initialSchedule: ReportSchedule | undefined;
  /** Saves the report with its schedule; resolves with a message on failure, nothing on success. */
  onPersist: (input: { name: string; schedule: ReportSchedule }) => Promise<string | void>;
  onClose: () => void;
};

/** The schedule modal wired to a save: it closes once the report is saved, and shows the failure otherwise. */
export function ScheduleReportDialog({ initialName, initialSchedule, onPersist, onClose }: ScheduleReportDialogProps) {
  const scheduling = useModalSubmit();

  return (
    <ScheduleReportModal
      initialName={initialName}
      initialSchedule={initialSchedule}
      isPending={scheduling.isPending}
      errorMessage={scheduling.errorMessage}
      onClose={onClose}
      onSchedule={async ({ name, ...schedule }) => {
        if (await scheduling.submit(() => onPersist({ name, schedule }))) onClose();
      }}
    />
  );
}
