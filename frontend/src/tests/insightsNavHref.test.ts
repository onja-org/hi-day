import { describe, expect, it } from "vitest";
import { insightsNavHref } from "@/lib/insightsNavHref";

const base = "/organisations/1/insights";
const timeline = `${base}/timeline`;

describe("insightsNavHref", () => {
  it("opens your own page from outside Insights", () => {
    expect(insightsNavHref("performance", base, "/organisations/1/activities/apps", new URLSearchParams())).toBe(
      `${base}/performance`,
    );
  });

  it("stays on the member being viewed, with the dates", () => {
    expect(
      insightsNavHref(
        "performance",
        base,
        timeline,
        new URLSearchParams("member=abc&from=2026-11-02&to=2026-11-08"),
      ),
    ).toBe(`${base}/performance?member=abc&from=2026-11-02&to=2026-11-08`);
  });

  it("keeps the dates on your own page", () => {
    expect(insightsNavHref("performance", base, timeline, new URLSearchParams("preset=last_week"))).toBe(
      `${base}/performance?preset=last_week`,
    );
  });

  it("opens your own page from the member list", () => {
    expect(insightsNavHref("timeline", base, base, new URLSearchParams("page=performance&preset=today"))).toBe(
      `${base}/timeline?preset=today`,
    );
  });

  it("ignores another section's query string", () => {
    expect(
      insightsNavHref("timeline", base, "/organisations/1/activities/apps", new URLSearchParams("member=abc")),
    ).toBe(timeline);
  });
});
