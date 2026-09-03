import { afterEach, describe, expect, it, vi } from "vitest";
import { createTeam } from "@/lib/createTeam";

describe("createTeam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the created team on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "team-1", name: "Engineering" }),
      }),
    );

    const result = await createTeam("org-1", "Engineering");

    expect(result).toEqual({
      ok: true,
      team: { id: "team-1", name: "Engineering" },
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "A team with this name already exists in this organisation.",
          }),
      }),
    );

    const result = await createTeam("org-1", "Engineering");

    expect(result).toEqual({
      ok: false,
      message: "A team with this name already exists in this organisation.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await createTeam("org-1", "Engineering");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
