"use client";

import type { KeyboardEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import clsx from "clsx";
import type { Task } from "@/types/task";
import { TaskCardContent } from "./TaskCardContent";

type TaskKanbanCardProps = {
  task: Task;
  /** Whether this caller may move it: a project admin, or its assignee. */
  movable: boolean;
  onOpen: () => void;
};

/**
 * The whole card is the drag target. A click (pointer moving less than
 * the board's 5px drag threshold) or Enter opens the task instead; Space
 * picks it up for a keyboard move. The card stays put while dragging
 * (dimmed) — DragOverlay draws the copy that follows the pointer, so no
 * inline transform is needed here.
 */
export function TaskKanbanCard({ task, movable, onOpen }: TaskKanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: !movable,
  });

  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>) {
    listeners?.onKeyDown?.(event);
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${task.name}${movable ? " — press Enter to open, Space to move" : " — press Enter to open"}`}
      aria-disabled={undefined}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={clsx(
        "touch-none rounded-md border border-input-border bg-white p-3 text-left shadow-sm transition duration-150 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
        movable && "cursor-grab active:cursor-grabbing",
        !movable && "cursor-pointer",
        isDragging && "opacity-40",
      )}
    >
      <TaskCardContent task={task} />
    </li>
  );
}
