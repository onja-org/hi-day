import { describe, expect, it } from "vitest";
import { hideEntryProjects } from "@/lib/hideEntryProjects";
import type { TimeEntryListItem } from "@/types/timeEntry";

const entry = {
  id: "e1",
  projectId: "p1",
  projectName: "Website",
  projectColour: "blue",
  taskId: "t1",
  taskName: "Header",
  durationSeconds: 60,
} as TimeEntryListItem;

describe("hideEntryProjects", () => {
  it("removes the project from every entry and leaves the rest alone", () => {
    const [hidden] = hideEntryProjects([entry]);

    expect(hidden.projectId).toBeNull();
    expect(hidden.projectName).toBeNull();
    expect(hidden.projectColour).toBeNull();
    expect(hidden.durationSeconds).toBe(60);
    expect(hidden.id).toBe("e1");
  });

  it("does not change the entries it was given", () => {
    hideEntryProjects([entry]);

    expect(entry.projectName).toBe("Website");
  });
});
