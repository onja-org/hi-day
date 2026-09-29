"use client";

import { useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import type { Task, TaskStage } from "@/types/task";
import { TaskKanbanCard } from "./TaskKanbanCard";

type TaskKanbanColumnProps = {
  stage: TaskStage;
  label: string;
  tasks: Task[];
  canMove: (task: Task) => boolean;
  onOpenTask: (task: Task) => void;
};

export function TaskKanbanColumn({ stage, label, tasks, canMove, onOpenTask }: TaskKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} column`}
      className={clsx(
        "flex min-h-64 flex-col gap-3 rounded-lg border p-3 transition-colors duration-150",
        isOver && "border-primary bg-primary/5",
        !isOver && "border-transparent bg-primary-dark/5",
      )}
    >
      <h2 className="flex items-center justify-between px-1 text-sm font-semibold text-primary-dark">
        {label}
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-900/70">
          {tasks.length}
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskKanbanCard
            key={task.id}
            task={task}
            movable={canMove(task)}
            onOpen={() => onOpenTask(task)}
          />
        ))}
      </ul>
      {tasks.length === 0 && (
        <p className="px-1 py-6 text-center text-xs text-slate-900/50">No tasks</p>
      )}
    </section>
  );
}
