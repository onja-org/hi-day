import { afterEach, describe, expect, it, vi } from "vitest";
import { getActiveMembers } from "@/lib/getActiveMembers";

describe("getActiveMembers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the member list on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "m-1",
              userId: "user-1",
              email: "a@b.test",
              name: "A B",
              role: "admin",
              teamIds: [],
              status: "active",
              joinedAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
      }),
    );

    const result = await getActiveMembers("org-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.members).toHaveLength(1);
      expect(result.members[0].role).toBe("admin");
    }
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Forbidden." }),
      }),
    );

    const result = await getActiveMembers("org-1");

    expect(result).toEqual({ ok: false, message: "Forbidden." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getActiveMembers("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
