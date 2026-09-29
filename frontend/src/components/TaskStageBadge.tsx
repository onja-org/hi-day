import clsx from "clsx";
import { TASK_STAGES } from "@/lib/taskStages";
import type { TaskStage } from "@/types/task";

export function TaskStageBadge({ stage }: { stage: TaskStage }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        stage === "todo" && "bg-primary-dark/10 text-primary-dark",
        stage === "in_progress" && "bg-primary/10 text-primary",
        stage === "done" && "bg-success/15 text-success",
      )}
    >
      {TASK_STAGES.find((option) => option.stage === stage)?.label}
    </span>
  );
}
