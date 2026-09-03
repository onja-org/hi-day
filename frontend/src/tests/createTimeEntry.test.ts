import { afterEach, describe, expect, it, vi } from "vitest";
import { createTimeEntry } from "@/lib/createTimeEntry";

describe("createTimeEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the created entry on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "entry-1",
            userId: "user-1",
            startedAt: "2026-01-01T09:00:00.000Z",
            endedAt: "2026-01-01T11:00:00.000Z",
            durationMinutes: 120,
            note: null,
            createdAt: "2026-01-01T11:00:00.000Z",
          }),
      }),
    );

    const result = await createTimeEntry("1", {
      startedAt: "2026-01-01T09:00:00.000Z",
      endedAt: "2026-01-01T11:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      entry: {
        id: "entry-1",
        userId: "user-1",
        startedAt: "2026-01-01T09:00:00.000Z",
        endedAt: "2026-01-01T11:00:00.000Z",
        durationMinutes: 120,
        note: null,
        createdAt: "2026-01-01T11:00:00.000Z",
      },
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "End time must be after the start time." }),
      }),
    );

    const result = await createTimeEntry("1", {
      startedAt: "2026-01-01T11:00:00.000Z",
      endedAt: "2026-01-01T09:00:00.000Z",
    });

    expect(result).toEqual({
      ok: false,
      message: "End time must be after the start time.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await createTimeEntry("1", {
      startedAt: "2026-01-01T09:00:00.000Z",
      endedAt: "2026-01-01T11:00:00.000Z",
    });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
