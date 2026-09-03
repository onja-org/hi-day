import { afterEach, describe, expect, it, vi } from "vitest";
import { updateMembership } from "@/lib/updateMembership";

describe("updateMembership", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the updated member on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "m-1",
            userId: "user-1",
            email: "a@b.test",
            name: "A B",
            role: "manager",
            teamId: null,
            status: "active",
            joinedAt: "2026-01-01T00:00:00.000Z",
          }),
      }),
    );

    const result = await updateMembership("org-1", "m-1", { role: "manager" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.member.role).toBe("manager");
    }
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Membership not found." }),
      }),
    );

    const result = await updateMembership("org-1", "m-1", { deactivate: true });

    expect(result).toEqual({ ok: false, message: "Membership not found." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await updateMembership("org-1", "m-1", { deactivate: true });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
