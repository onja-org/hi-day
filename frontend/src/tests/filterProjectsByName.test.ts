import { describe, expect, it } from "vitest";
import { filterProjectsByName } from "@/lib/filterProjectsByName";

const projects = [{ name: "Website" }, { name: "Mobile app" }, { name: "Web API" }];

describe("filterProjectsByName", () => {
  it("keeps every project for a blank search", () => {
    expect(filterProjectsByName(projects, "  ")).toEqual(projects);
  });

  it("matches a case-insensitive substring of the name", () => {
    expect(filterProjectsByName(projects, "WEB")).toEqual([
      { name: "Website" },
      { name: "Web API" },
    ]);
  });

  it("returns nothing when no name matches", () => {
    expect(filterProjectsByName(projects, "desktop")).toEqual([]);
  });
});
