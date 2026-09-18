import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteTeam } from "@/lib/deleteTeam";

describe("deleteTeam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Team deleted" }),
      }),
    );

    const result = await deleteTeam("org-1", "team-1");

    expect(result).toEqual({ ok: true, message: "Team deleted" });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "This organisation must always have at least one team.",
          }),
      }),
    );

    const result = await deleteTeam("org-1", "team-1");

    expect(result).toEqual({
      ok: false,
      message: "This organisation must always have at least one team.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await deleteTeam("org-1", "team-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
