import { describe, expect, it } from "vitest";
import { groupTasksByStage } from "@/lib/groupTasksByStage";
import type { Task, TaskStage } from "@/types/task";

function task(id: string, stage: TaskStage): Task {
  return {
    id,
    projectId: "p-1",
    name: id,
    description: null,
    estimate: null,
    dueDate: null,
    status: stage === "done" ? "closed" : "open",
    closedAt: null,
    stage,
    assignee: null,
    assignedToMe: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("groupTasksByStage", () => {
  it("puts each task in its column, preserving order", () => {
    const groups = groupTasksByStage([
      task("a", "todo"),
      task("b", "done"),
      task("c", "todo"),
      task("d", "in_progress"),
    ]);
    expect(groups.todo.map((t) => t.id)).toEqual(["a", "c"]);
    expect(groups.in_progress.map((t) => t.id)).toEqual(["d"]);
    expect(groups.done.map((t) => t.id)).toEqual(["b"]);
  });

  it("returns empty columns for no tasks", () => {
    expect(groupTasksByStage([])).toEqual({ todo: [], in_progress: [], done: [] });
  });
});
