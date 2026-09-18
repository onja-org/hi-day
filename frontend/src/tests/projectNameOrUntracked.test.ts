import { describe, expect, it } from "vitest";
import { projectNameOrUntracked } from "@/lib/projectNameOrUntracked";

const projects = [
  { id: "p-1", name: "Website" },
  { id: "p-2", name: "Mobile app" },
];

describe("projectNameOrUntracked", () => {
  it("returns the matching project's name", () => {
    expect(projectNameOrUntracked(projects, "p-1")).toBe("Website");
  });

  it("returns 'Untracked' for a null projectId", () => {
    expect(projectNameOrUntracked(projects, null)).toBe("Untracked");
  });

  it("returns 'Untracked' for a projectId not found in the given list", () => {
    expect(projectNameOrUntracked(projects, "does-not-exist")).toBe("Untracked");
  });
});
