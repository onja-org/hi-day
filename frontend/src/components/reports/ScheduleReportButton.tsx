import { ClockIcon } from "@phosphor-icons/react";

type ScheduleReportButtonProps = {
  onClick: () => void;
};

/** The clock icon button that asks for the schedule-report modal. */
export function ScheduleReportButton({ onClick }: ScheduleReportButtonProps) {
  return (
    <button
      type="button"
      aria-label="Schedule report"
      title="Schedule report delivery"
      onClick={onClick}
      className="flex size-11 cursor-pointer items-center justify-center rounded-md border border-input-border text-primary transition-colors duration-150 hover:border-primary"
    >
      <ClockIcon size={16} aria-hidden="true" />
    </button>
  );
}
