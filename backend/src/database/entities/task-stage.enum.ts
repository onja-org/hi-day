/**
 * Where a Task sits on the Kanban board. `DONE` is kept in step with the
 * Task's `closedAt` (closing sets DONE, moving to DONE closes it), so the
 * open/closed rules the timer and time entries rely on are unchanged.
 */
export enum TaskStage {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}
