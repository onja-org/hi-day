import { afterEach, describe, expect, it, vi } from "vitest";
import { stopTimeEntry } from "@/lib/stopTimeEntry";

describe("stopTimeEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the stopped entry on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "te-1", endedAt: "2026-01-01T00:00:00Z" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await stopTimeEntry("org-1");

    expect(result).toEqual({
      ok: true,
      entry: { id: "te-1", endedAt: "2026-01-01T00:00:00Z" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/organisations/org-1/time-entries/stop",
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

    const result = await stopTimeEntry("org-1");

    expect(result).toEqual({
      ok: false,
      message: "No timer is currently running.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await stopTimeEntry("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
