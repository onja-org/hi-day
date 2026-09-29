"use client";

import { useDraggable } from "@dnd-kit/core";
import { DotsSixVertical } from "@phosphor-icons/react";
import clsx from "clsx";
import type { Task } from "@/types/task";
import { TaskCardContent } from "./TaskCardContent";

type TaskKanbanCardProps = {
  task: Task;
  /** Whether this caller may move it: a project admin, or its assignee. */
  movable: boolean;
  onOpen?: () => void;
};

/**
 * Dragged by its handle (a real button, so it's reachable by keyboard:
 * Space to pick up, arrows to move, Space to drop) rather than the whole
 * card, which keeps the task name free to be its own "edit" button. The
 * card stays put while dragging (dimmed) — DragOverlay draws the copy that
 * follows the pointer, so no inline transform is needed here.
 */
export function TaskKanbanCard({ task, movable, onOpen }: TaskKanbanCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: !movable,
  });

  return (
    <li
      ref={setNodeRef}
      className={clsx(
        "flex gap-2 rounded-md border border-input-border bg-white p-3 shadow-sm transition-opacity duration-150",
        isDragging && "opacity-40",
      )}
    >
      {movable ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Move ${task.name}`}
          className="-ml-1 flex h-6 shrink-0 cursor-grab touch-none items-center rounded text-primary-dark/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none active:cursor-grabbing"
        >
          <DotsSixVertical size={18} aria-hidden="true" />
        </button>
      ) : (
        <span
          title="Only this task's assignee or a project manager can move it"
          className="-ml-1 flex h-6 w-4 shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        {onOpen ? (
          <button type="button" onClick={onOpen} className="w-full cursor-pointer text-left">
            <TaskCardContent task={task} />
          </button>
        ) : (
          <TaskCardContent task={task} />
        )}
      </div>
    </li>
  );
}
