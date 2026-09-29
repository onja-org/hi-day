import { afterEach, describe, expect, it, vi } from "vitest";
import { getPendingInvitations } from "@/lib/getPendingInvitations";

describe("getPendingInvitations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the invitation list on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "i-1",
              email: "a@b.test",
              role: "member",
              teamIds: [],
              projectIds: [],
              status: "pending",
              createdAt: "2026-01-01T00:00:00.000Z",
              expiresAt: "2026-01-04T00:00:00.000Z",
            },
          ]),
      }),
    );

    const result = await getPendingInvitations("org-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invitations).toHaveLength(1);
      expect(result.invitations[0].email).toBe("a@b.test");
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

    const result = await getPendingInvitations("org-1");

    expect(result).toEqual({ ok: false, message: "Forbidden." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getPendingInvitations("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
