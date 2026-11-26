import { afterEach, describe, expect, it, vi } from "vitest";
import { getSummaryEmailPreferences } from "@/lib/getSummaryEmailPreferences";

const preferences = [
  { kind: "personal-weekly", available: true, enabled: true },
];

describe("getSummaryEmailPreferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads your own preferences for the organisation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(preferences),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSummaryEmailPreferences("100001")).resolves.toEqual({
      ok: true,
      message: "",
      preferences,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100001/summary-emails/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "No access." }),
      }),
    );

    await expect(getSummaryEmailPreferences("100001")).resolves.toEqual({
      ok: false,
      message: "No access.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(getSummaryEmailPreferences("100001")).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
