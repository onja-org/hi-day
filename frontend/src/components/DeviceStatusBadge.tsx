import clsx from "clsx";
import type { DeviceStatus } from "@/types/device";

type DeviceStatusBadgeProps = {
  status: DeviceStatus;
};

const LABELS: Record<DeviceStatus, string> = {
  active: "Active",
  offline: "Offline",
  signed_out: "Signed out",
};

export function DeviceStatusBadge({ status }: DeviceStatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "active" && "bg-primary/10 text-primary",
        status === "offline" && "bg-secondary/10 text-secondary",
        status === "signed_out" && "bg-error/10 text-error",
      )}
    >
      {LABELS[status]}
    </span>
  );
}
