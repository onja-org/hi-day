import { afterEach, describe, expect, it, vi } from "vitest";
import { renameTimesheetReason } from "@/lib/renameTimesheetReason";

describe("renameTimesheetReason", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("patches the one reason with its new label", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          reason: { id: "r-1", label: "Internal sync" },
          message: "Reason updated",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      renameTimesheetReason("org-1", "r-1", "Internal sync"),
    ).resolves.toEqual({
      ok: true,
      reason: { id: "r-1", label: "Internal sync" },
      message: "Reason updated",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/timesheet-reasons/r-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ label: "Internal sync" }),
      }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Reason not found" }),
      }),
    );

    await expect(
      renameTimesheetReason("org-1", "r-gone", "Anything"),
    ).resolves.toEqual({ ok: false, message: "Reason not found" });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(
      renameTimesheetReason("org-1", "r-1", "Anything"),
    ).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
