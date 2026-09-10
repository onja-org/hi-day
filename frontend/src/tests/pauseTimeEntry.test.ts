import { afterEach, describe, expect, it, vi } from "vitest";
import { pauseTimeEntry } from "@/lib/pauseTimeEntry";

describe("pauseTimeEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the paused entry on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "te-1", pausedAt: "2026-01-01T00:00:00Z" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await pauseTimeEntry("org-1");

    expect(result).toEqual({
      ok: true,
      entry: { id: "te-1", pausedAt: "2026-01-01T00:00:00Z" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/time-entries/pause",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the backend's error message when nothing is running", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "No timer is currently running." }),
      }),
    );

    const result = await pauseTimeEntry("org-1");

    expect(result).toEqual({
      ok: false,
      message: "No timer is currently running.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await pauseTimeEntry("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
