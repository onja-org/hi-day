import { afterEach, describe, expect, it, vi } from "vitest";
import { getMemberActivity } from "@/lib/getMemberActivity";

describe("getMemberActivity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the member's entries on success", async () => {
    const entries = [
      {
        id: "activity-1",
        userId: "user-2",
        content: "Working on the report.",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(entries),
      }),
    );

    const result = await getMemberActivity("1", "membership-2");

    expect(result).toEqual({ ok: true, entries });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "You cannot view this member's activity." }),
      }),
    );

    const result = await getMemberActivity("1", "membership-2");

    expect(result).toEqual({
      ok: false,
      message: "You cannot view this member's activity.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getMemberActivity("1", "membership-2");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
