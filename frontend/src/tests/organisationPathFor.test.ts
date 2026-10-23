import { describe, expect, it } from "vitest";
import { organisationPathFor } from "@/lib/organisationPathFor";

describe("organisationPathFor", () => {
  it("sends the timesheet link to the organisation's timesheets", () => {
    expect(organisationPathFor("timesheet", 7)).toBe("/organisations/7/time_entries");
  });

  it("sends the notes link to the organisation's notes", () => {
    expect(organisationPathFor("notes", 7)).toBe("/organisations/7/activities/notes");
  });

  it("has no page for an unknown destination", () => {
    expect(organisationPathFor("constructor", 7)).toBeNull();
    expect(organisationPathFor("", 7)).toBeNull();
  });
});
