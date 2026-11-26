import { afterEach, describe, expect, it, vi } from "vitest";
import { updateSummaryEmailPreference } from "@/lib/updateSummaryEmailPreference";

describe("updateSummaryEmailPreference", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("patches one email and returns the updated list", async () => {
    const preferences = [
      { kind: "personal-weekly", available: true, enabled: false },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(preferences),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateSummaryEmailPreference("100001", "personal-weekly", false),
    ).resolves.toEqual({
      ok: true,
      message: "Summary email turned off",
      preferences,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100001/summary-emails/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ kind: "personal-weekly", enabled: false }),
      }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "Your organisation has this summary email turned off for you.",
          }),
      }),
    );

    await expect(
      updateSummaryEmailPreference("100001", "personal-daily", true),
    ).resolves.toEqual({
      ok: false,
      message: "Your organisation has this summary email turned off for you.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(
      updateSummaryEmailPreference("100001", "personal-daily", true),
    ).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
