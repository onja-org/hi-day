import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safeRedirectPath";

describe("safeRedirectPath", () => {
  it("returns an internal path unchanged", () => {
    expect(safeRedirectPath("/link-device?code=abc")).toBe(
      "/link-device?code=abc",
    );
  });

  it("falls back to the dashboard when next is undefined", () => {
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
  });

  it("falls back to the dashboard for an absolute URL", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
  });

  it("falls back to the dashboard for a protocol-relative URL", () => {
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
  });

  // Browsers read a backslash as a slash and drop tabs and newlines, so each
  // of these is "//evil.example" by the time the page navigates.
  it.each([
    ["a backslash", "/\\evil.example"],
    ["a tab", "/\t/evil.example"],
    ["a newline", "/\n/evil.example"],
  ])(
    "falls back to the dashboard for a protocol-relative URL hidden by %s",
    (_label, next) => {
      expect(safeRedirectPath(next)).toBe("/dashboard");
    },
  );

  it("keeps the query string and hash of an internal path", () => {
    expect(safeRedirectPath("/reports?range=this_week#chart")).toBe(
      "/reports?range=this_week#chart",
    );
  });

  it("falls back to the dashboard for an empty string", () => {
    expect(safeRedirectPath("")).toBe("/dashboard");
  });
});
