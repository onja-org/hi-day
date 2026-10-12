import { afterEach, describe, expect, it, vi } from "vitest";
import { createTimesheetReason } from "@/lib/createTimesheetReason";

describe("createTimesheetReason", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the label to the organisation's reasons collection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          reason: { id: "r-1", label: "Client meeting" },
          message: "Reason added",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createTimesheetReason("org-1", "Client meeting"),
    ).resolves.toEqual({
      ok: true,
      reason: { id: "r-1", label: "Client meeting" },
      message: "Reason added",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/timesheet-reasons",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ label: "Client meeting" }),
      }),
    );
  });

  it("surfaces a duplicate-label refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "That reason already exists" }),
      }),
    );

    await expect(
      createTimesheetReason("org-1", "client meeting"),
    ).resolves.toEqual({ ok: false, message: "That reason already exists" });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(createTimesheetReason("org-1", "Anything")).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
