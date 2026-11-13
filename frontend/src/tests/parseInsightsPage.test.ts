import { describe, expect, it } from "vitest";
import { parseInsightsPage } from "@/lib/parseInsightsPage";

describe("parseInsightsPage", () => {
  it("reads a known page", () => {
    expect(parseInsightsPage("performance")).toBe("performance");
    expect(parseInsightsPage("timeline")).toBe("timeline");
    expect(parseInsightsPage("unusual-activity")).toBe("unusual-activity");
  });

  it("falls back to the Timeline", () => {
    expect(parseInsightsPage(null)).toBe("timeline");
    expect(parseInsightsPage("highlights")).toBe("timeline");
  });
});
