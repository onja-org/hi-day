import clsx from "clsx";
import type { TaskStatus } from "@/types/task";

type TaskStatusBadgeProps = {
  status: TaskStatus;
};

const LABELS: Record<TaskStatus, string> = {
  open: "Open",
  closed: "Closed",
};

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "open" && "bg-primary/10 text-primary",
        status === "closed" && "bg-secondary/10 text-secondary",
      )}
    >
      {LABELS[status]}
    </span>
  );
}
