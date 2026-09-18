import { afterEach, describe, expect, it, vi } from "vitest";
import { createActivity } from "@/lib/createActivity";

describe("createActivity", () => {
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
            entry: {
              id: "activity-1",
              userId: "user-1",
              content: "Working on the report.",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
            message: "Activity posted",
          }),
      }),
    );

    const result = await createActivity("1", {
      content: "Working on the report.",
    });

    expect(result).toEqual({
      ok: true,
      entry: {
        id: "activity-1",
        userId: "user-1",
        content: "Working on the report.",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      message: "Activity posted",
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "content must not be empty" }),
      }),
    );

    const result = await createActivity("1", { content: "" });

    expect(result).toEqual({
      ok: false,
      message: "content must not be empty",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await createActivity("1", { content: "Anything" });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
