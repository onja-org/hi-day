import clsx from "clsx";
import type { InvitationStatus } from "@/types/invitation";

type InvitationStatusBadgeProps = {
  status: InvitationStatus;
};

const LABELS: Record<InvitationStatus, string> = {
  pending: "Pending",
  expired: "Expired",
  revoked: "Revoked",
  accepted: "Accepted",
};

export function InvitationStatusBadge({ status }: InvitationStatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
        status === "pending" && "bg-primary/10 text-primary",
        status === "accepted" && "bg-success text-white",
        (status === "expired" || status === "revoked") && "bg-error text-white",
      )}
    >
      {LABELS[status]}
    </span>
  );
}
