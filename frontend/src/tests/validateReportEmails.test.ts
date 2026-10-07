import { describe, expect, it } from "vitest";
import { validateReportEmails } from "@/lib/validateReportEmails";

describe("validateReportEmails", () => {
  it("returns the parsed, lower-cased, deduplicated addresses with no error", () => {
    expect(validateReportEmails("A@b.co, a@b.co; c@d.org")).toEqual({ emails: ["a@b.co", "c@d.org"], error: null });
  });

  it("names every address that doesn't look valid", () => {
    expect(validateReportEmails("ok@b.co, nope, a@b")).toEqual({
      emails: ["ok@b.co", "nope", "a@b"],
      error: "Not a valid email address: nope, a@b",
    });
  });

  it("has no error for an empty field", () => {
    expect(validateReportEmails("  ")).toEqual({ emails: [], error: null });
  });
});
