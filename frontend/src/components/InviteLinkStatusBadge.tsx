import clsx from "clsx";
import type { InviteLinkStatus } from "@/types/inviteLink";

const LABELS: Record<InviteLinkStatus, string> = {
  active: "Active",
  disabled: "Disabled",
  expired: "Expired",
  full: "Full",
};

export function InviteLinkStatusBadge({ status }: { status: InviteLinkStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
        status === "active" && "bg-success text-white",
        status === "disabled" && "bg-primary-dark/10 text-primary-dark",
        (status === "expired" || status === "full") && "bg-error text-white",
      )}
    >
      {LABELS[status]}
    </span>
  );
}
