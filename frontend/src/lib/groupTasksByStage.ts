import type { Task, TaskStage } from "@/types/task";

/** Buckets tasks into their Kanban columns, keeping each column's input order. */
export function groupTasksByStage(tasks: Task[]): Record<TaskStage, Task[]> {
  const groups: Record<TaskStage, Task[]> = { todo: [], in_progress: [], done: [] };
  for (const task of tasks) {
    groups[task.stage].push(task);
  }
  return groups;
}
