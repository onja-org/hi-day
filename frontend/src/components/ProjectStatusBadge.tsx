import clsx from "clsx";
import type { ProjectStatus } from "@/types/project";

type ProjectStatusBadgeProps = {
  status: ProjectStatus;
};

const LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  archived: "Archived",
};

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "active" && "bg-primary/10 text-primary",
        status === "archived" && "bg-secondary/10 text-secondary",
      )}
    >
      {LABELS[status]}
    </span>
  );
}
