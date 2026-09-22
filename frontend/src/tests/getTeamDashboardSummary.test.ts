import { afterEach, describe, expect, it, vi } from "vitest";
import { getTeamDashboardSummary } from "@/lib/getTeamDashboardSummary";

describe("getTeamDashboardSummary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the team summary on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            memberCount: 2,
            workedThisWeekSeconds: 7200,
            workedThisWeekDeltaSeconds: 0,
            projectsWorkedThisWeek: 1,
            projectsWorkedDelta: 0,
            weeklyActivityPercentage: null,
            weeklyActivityDeltaPercentage: null,
            projectsThisWeek: [],
            members: [],
            recentActivity: [],
          }),
      }),
    );

    const result = await getTeamDashboardSummary("org-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.memberCount).toBe(2);
      expect(result.summary.workedThisWeekSeconds).toBe(7200);
    }
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Forbidden." }),
      }),
    );

    const result = await getTeamDashboardSummary("org-1");

    expect(result).toEqual({ ok: false, message: "Forbidden." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getTeamDashboardSummary("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
