import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMembershipTimesheetOverrides } from "@/lib/resetMembershipTimesheetOverrides";

describe("resetMembershipTimesheetOverrides", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the bulk-reset route and reports how many were cleared", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ cleared: 3, message: "Cleared 3 per-member overrides" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resetMembershipTimesheetOverrides("org-1")).resolves.toEqual({
      ok: true,
      cleared: 3,
      message: "Cleared 3 per-member overrides",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/memberships/timesheets/reset-overrides",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "You do not have the required role for this organisation.",
          }),
      }),
    );

    await expect(resetMembershipTimesheetOverrides("org-1")).resolves.toEqual({
      ok: false,
      message: "You do not have the required role for this organisation.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(resetMembershipTimesheetOverrides("org-1")).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
