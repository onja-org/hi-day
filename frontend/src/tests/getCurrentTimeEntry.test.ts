import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentTimeEntry } from "@/lib/getCurrentTimeEntry";

describe("getCurrentTimeEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the current entry and server clock on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ entry: null, now: "2026-01-01T00:00:00Z" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCurrentTimeEntry("org-1");

    expect(result).toEqual({
      ok: true,
      data: { entry: null, now: "2026-01-01T00:00:00Z" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/organisations/org-1/time-entries/current",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getCurrentTimeEntry("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
