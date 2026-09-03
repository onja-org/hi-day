import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyTimeEntries } from "@/lib/getMyTimeEntries";

describe("getMyTimeEntries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the caller's entries on success", async () => {
    const entries = [
      {
        id: "entry-1",
        userId: "user-1",
        startedAt: "2026-01-01T09:00:00.000Z",
        endedAt: "2026-01-01T11:00:00.000Z",
        durationMinutes: 120,
        note: null,
        createdAt: "2026-01-01T11:00:00.000Z",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(entries),
      }),
    );

    const result = await getMyTimeEntries("1");

    expect(result).toEqual({ ok: true, entries });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Not authenticated." }),
      }),
    );

    const result = await getMyTimeEntries("1");

    expect(result).toEqual({ ok: false, message: "Not authenticated." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getMyTimeEntries("1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
