import { afterEach, describe, expect, it, vi } from "vitest";
import { revokeInvitation } from "@/lib/revokeInvitation";

describe("revokeInvitation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Invitation revoked" }),
      }),
    );

    const result = await revokeInvitation("org-1", "invitation-1");

    expect(result).toEqual({ ok: true, message: "Invitation revoked" });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "This invitation has already been accepted." }),
      }),
    );

    const result = await revokeInvitation("org-1", "invitation-1");

    expect(result).toEqual({
      ok: false,
      message: "This invitation has already been accepted.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await revokeInvitation("org-1", "invitation-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
