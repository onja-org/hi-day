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

  it("falls back to the dashboard for an empty string", () => {
    expect(safeRedirectPath("")).toBe("/dashboard");
  });
});
