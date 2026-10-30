import { describe, expect, it } from "vitest";
import { abbreviateProjects } from "@/lib/abbreviateProjects";

describe("abbreviateProjects", () => {
  it("keeps the first letter of each project, uppercased", () => {
    expect(abbreviateProjects("dev, Onja, test")).toBe("D, O, T");
  });

  it("leaves a single project as one letter", () => {
    expect(abbreviateProjects("Website")).toBe("W");
  });

  it("leaves the no-project dash alone", () => {
    expect(abbreviateProjects("-")).toBe("-");
  });
});
