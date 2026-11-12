import { describe, expect, it } from "vitest";
import { insightsHref } from "@/lib/insightsHref";

const base = "/organisations/1/insights";

describe("insightsHref", () => {
  it("points at one member's page, keeping the dates", () => {
    expect(
      insightsHref(
        base,
        { kind: "page", page: "performance", member: "abc" },
        new URLSearchParams("from=2026-11-02&to=2026-11-08"),
      ),
    ).toBe(`${base}/performance?member=abc&from=2026-11-02&to=2026-11-08`);
  });

  it("leaves the member out for your own page", () => {
    expect(
      insightsHref(base, { kind: "page", page: "timeline", member: null }, new URLSearchParams("preset=last_week")),
    ).toBe(`${base}/timeline?preset=last_week`);
  });

  it("points at the member list, remembering the page", () => {
    expect(insightsHref(base, { kind: "list", page: "performance" }, new URLSearchParams())).toBe(
      `${base}?page=performance`,
    );
  });

  it("never carries the current member or unrelated keys along", () => {
    expect(
      insightsHref(base, { kind: "list", page: "timeline" }, new URLSearchParams("member=abc&day=-1&preset=today")),
    ).toBe(`${base}?page=timeline&preset=today`);
  });
});
