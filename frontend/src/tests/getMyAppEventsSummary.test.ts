import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyAppEventsSummary } from "@/lib/getMyAppEventsSummary";

describe("getMyAppEventsSummary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the summary on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            date: "2026-09-08",
            totalSecondsSpent: 70,
            items: [
              { appName: "Google Chrome", secondsSpent: 50 },
              { appName: "Slack", secondsSpent: 20 },
            ],
          }),
      }),
    );

    const result = await getMyAppEventsSummary("org-1");

    expect(result).toEqual({
      ok: true,
      summary: {
        date: "2026-09-08",
        totalSecondsSpent: 70,
        items: [
          { appName: "Google Chrome", secondsSpent: 50 },
          { appName: "Slack", secondsSpent: 20 },
        ],
      },
    });
  });

  it("returns the backend's error message when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "date must be formatted as YYYY-MM-DD." }),
      }),
    );

    const result = await getMyAppEventsSummary("org-1");

    expect(result).toEqual({
      ok: false,
      message: "date must be formatted as YYYY-MM-DD.",
    });
  });

  it("takes the first message when the backend returns an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: ["first error", "second error"] }),
      }),
    );

    const result = await getMyAppEventsSummary("org-1");

    expect(result).toEqual({ ok: false, message: "first error" });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getMyAppEventsSummary("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
