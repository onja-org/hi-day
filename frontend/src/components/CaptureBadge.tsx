import clsx from "clsx";
import type { CaptureStatus } from "@/types/device";

type CaptureBadgeProps = {
  /** What is being captured — "Apps" or "Websites". */
  label: string;
  status: CaptureStatus | null;
  detail: string | null;
};

const LABELS: Record<CaptureStatus, string> = {
  ok: "Recording",
  degraded: "Partial",
  unavailable: "Not recording",
};

/** Read with the detail visible: an admin needs the why, not just the badge. */
export function CaptureBadge({ label, status, detail }: CaptureBadgeProps) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-1.5 text-xs">
        <span className="font-medium">{label}</span>
        {status ? (
          <span
            className={clsx(
              "inline-flex items-center rounded-full px-2.5 py-0.5 font-medium",
              status === "ok" && "bg-success/10 text-success",
              status === "degraded" && "bg-cream text-slate-900",
              status === "unavailable" && "bg-error/10 text-error",
            )}
          >
            {LABELS[status]}
          </span>
        ) : (
          <span className="text-slate-900/70">Not reported</span>
        )}
      </span>
      {status && status !== "ok" && detail && (
        <span className="max-w-xs text-xs text-slate-900/70">{detail}</span>
      )}
    </div>
  );
}
