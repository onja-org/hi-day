import { afterEach, describe, expect, it, vi } from "vitest";
import { getTimesheetReasons } from "@/lib/getTimesheetReasons";

describe("getTimesheetReasons", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the organisation's reasons", async () => {
    const reasons = [{ id: "r-1", label: "Forgot to start timer" }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(reasons),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTimesheetReasons("org-1")).resolves.toEqual({
      ok: true,
      reasons,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/timesheet-reasons",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Membership not found." }),
      }),
    );

    await expect(getTimesheetReasons("org-1")).resolves.toEqual({
      ok: false,
      message: "Membership not found.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(getTimesheetReasons("org-1")).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
