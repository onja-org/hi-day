import type { TaskStage } from "@/types/task";

/** The Kanban columns, in board order, with their display labels. */
export const TASK_STAGES: { stage: TaskStage; label: string }[] = [
  { stage: "todo", label: "To do" },
  { stage: "in_progress", label: "In progress" },
  { stage: "done", label: "Done" },
];
