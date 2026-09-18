import { afterEach, describe, expect, it, vi } from "vitest";
import { resumeTimeEntry } from "@/lib/resumeTimeEntry";

describe("resumeTimeEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the resumed entry on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          entry: { id: "te-1", pausedAt: null },
          message: "Timer resumed",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resumeTimeEntry("org-1");

    expect(result).toEqual({
      ok: true,
      entry: { id: "te-1", pausedAt: null },
      message: "Timer resumed",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/time-entries/resume",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the backend's error message when the timer isn't paused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "This timer is not paused." }),
      }),
    );

    const result = await resumeTimeEntry("org-1");

    expect(result).toEqual({
      ok: false,
      message: "This timer is not paused.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await resumeTimeEntry("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
