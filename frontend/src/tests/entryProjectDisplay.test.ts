import { describe, expect, it } from "vitest";
import {
  entryProjectColour,
  entryProjectName,
  entryTitle,
  NO_PROJECT_LABEL,
  UNTITLED_ENTRY_LABEL,
} from "@/lib/entryProjectDisplay";

const withProject = { projectName: "Website", projectColour: "blue" as const };
const withoutProject = { projectName: null, projectColour: null };

describe("entryProjectDisplay", () => {
  it("uses the project's own name and colour when there is one", () => {
    expect(entryTitle(withProject)).toBe("Website");
    expect(entryProjectName(withProject)).toBe("Website");
    expect(entryProjectColour(withProject)).toBe("blue");
  });

  it("titles a project-less entry neutrally, but labels it plainly in reports", () => {
    expect(entryTitle(withoutProject)).toBe(UNTITLED_ENTRY_LABEL);
    expect(entryProjectName(withoutProject)).toBe(NO_PROJECT_LABEL);
  });

  it("draws a project-less entry in gray", () => {
    expect(entryProjectColour(withoutProject)).toBe("gray");
  });
});
