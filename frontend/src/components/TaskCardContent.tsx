import { CalendarBlank, Clock } from "@phosphor-icons/react";
import { getInitials } from "@/lib/getInitials";
import type { Task } from "@/types/task";

/** What a Kanban card shows — shared by the card in its column and the
 * copy that follows the pointer while it's being dragged. */
export function TaskCardContent({ task }: { task: Task }) {
  const assigneeLabel = task.assignee ? (task.assignee.name ?? task.assignee.email) : null;

  return (
    <span className="flex flex-col gap-2">
      <span className="font-medium break-words text-slate-900">{task.name}</span>
      <span className="flex items-center justify-between gap-2 text-xs text-slate-900/70">
        <span className="flex items-center gap-3">
          {task.dueDate && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <CalendarBlank size={14} aria-hidden="true" />
              {task.dueDate}
            </span>
          )}
          {task.estimate && (
            <span className="flex items-center gap-1">
              <Clock size={14} aria-hidden="true" />
              {task.estimate}h
            </span>
          )}
        </span>
        {assigneeLabel ? (
          <span
            title={assigneeLabel}
            aria-label={`Assigned to ${assigneeLabel}`}
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
          >
            {getInitials(task.assignee?.name ?? null, task.assignee?.email)}
          </span>
        ) : (
          <span className="text-slate-900/50">Unassigned</span>
        )}
      </span>
    </span>
  );
}
