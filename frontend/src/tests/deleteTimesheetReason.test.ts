import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteTimesheetReason } from "@/lib/deleteTimesheetReason";

describe("deleteTimesheetReason", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes the one reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Reason deleted" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteTimesheetReason("org-1", "r-1")).resolves.toEqual({
      ok: true,
      message: "Reason deleted",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/timesheet-reasons/r-1",
      expect.objectContaining({ method: "DELETE" }),
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

    await expect(deleteTimesheetReason("org-1", "r-gone")).resolves.toEqual({
      ok: false,
      message: "Reason not found",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(deleteTimesheetReason("org-1", "r-1")).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
