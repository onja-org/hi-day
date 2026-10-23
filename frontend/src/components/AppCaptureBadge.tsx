import clsx from "clsx";
import type { AppCaptureStatus } from "@/types/device";

type AppCaptureBadgeProps = {
  status: AppCaptureStatus | null;
  detail: string | null;
};

const LABELS: Record<AppCaptureStatus, string> = {
  ok: "Recording",
  degraded: "Partial",
  unavailable: "Not recording",
};

/** Read with the detail visible: an admin needs the why, not just the badge. */
export function AppCaptureBadge({ status, detail }: AppCaptureBadgeProps) {
  if (!status) {
    return <span className="text-slate-900/70">Not reported</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={clsx(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          status === "ok" && "bg-success/10 text-success",
          status === "degraded" && "bg-cream text-slate-900",
          status === "unavailable" && "bg-error/10 text-error",
        )}
      >
        {LABELS[status]}
      </span>
      {status !== "ok" && detail && (
        <span className="max-w-xs text-xs text-slate-900/70">{detail}</span>
      )}
    </div>
  );
}
