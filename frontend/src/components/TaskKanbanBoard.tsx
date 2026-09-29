"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  defaultKeyboardCoordinateGetter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { useSetTaskStage } from "@/hooks/useSetTaskStage";
import { columnJumpDelta } from "@/lib/columnJumpDelta";
import { groupTasksByStage } from "@/lib/groupTasksByStage";
import { TASK_STAGES } from "@/lib/taskStages";
import type { Task, TaskStage } from "@/types/task";
import { TaskCardContent } from "./TaskCardContent";
import { TaskKanbanColumn } from "./TaskKanbanColumn";

// Drop into the column under the pointer — judging by how much of the
// (wide) card overlaps each column picks the wrong one near an edge.
// Keyboard drags have no pointer, so they fall back to overlap.
const columnUnderPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

// Left/Right arrows jump a whole column; Up/Down keep the default nudge.
const jumpColumns: KeyboardCoordinateGetter = (event, args) => {
  const direction = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  const card = args.context.collisionRect;
  if (direction === 0 || !card) return defaultKeyboardCoordinateGetter(event, args);
  event.preventDefault();
  const delta = columnJumpDelta(card, [...args.context.droppableRects.values()], direction);
  return delta === null
    ? args.currentCoordinates
    : { ...args.currentCoordinates, x: args.currentCoordinates.x + delta };
};

type TaskKanbanBoardProps = {
  organisationId: string;
  projectId: string;
  tasks: Task[];
  /** Project admin: can move any card and edit it once opened. */
  canManage: boolean;
  isArchived: boolean;
  onOpenTask: (task: Task) => void;
};

export function TaskKanbanBoard({
  organisationId,
  projectId,
  tasks,
  canManage,
  isArchived,
  onOpenTask,
}: TaskKanbanBoardProps) {
  const [dragging, setDragging] = useState<Task | null>(null);
  const setStage = useSetTaskStage(organisationId, projectId);
  // A small move threshold so a plain click opens the card instead of dragging it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Space picks a card up; Enter is left free to open it.
    useSensor(KeyboardSensor, {
      coordinateGetter: jumpColumns,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const groups = groupTasksByStage(tasks);
  const canMove = (task: Task) => !isArchived && (canManage || task.assignedToMe);

  function handleDragStart(event: DragStartEvent) {
    setDragging((event.active.data.current?.task as Task | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const task = event.active.data.current?.task as Task | undefined;
    const stage = event.over?.id as TaskStage | undefined;
    if (task && stage && stage !== task.stage) {
      setStage.mutate({ taskId: task.id, stage });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={columnUnderPointer}
      // The columns sit side by side, so never auto-scroll sideways.
      autoScroll={{ threshold: { x: 0, y: 0.2 } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {TASK_STAGES.map(({ stage, label }) => (
          <TaskKanbanColumn
            key={stage}
            stage={stage}
            label={label}
            tasks={groups[stage]}
            canMove={canMove}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
      <DragOverlay>
        {dragging && (
          <div className="rotate-1 cursor-grabbing rounded-md border border-primary bg-white p-3 shadow-lg">
            <TaskCardContent task={dragging} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
