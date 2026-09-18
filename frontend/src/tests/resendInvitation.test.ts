import { afterEach, describe, expect, it, vi } from "vitest";
import { resendInvitation } from "@/lib/resendInvitation";

describe("resendInvitation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Invitation resent" }),
      }),
    );

    const result = await resendInvitation("org-1", "invitation-1");

    expect(result).toEqual({ ok: true, message: "Invitation resent" });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Not found." }),
      }),
    );

    const result = await resendInvitation("org-1", "invitation-1");

    expect(result).toEqual({ ok: false, message: "Not found." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await resendInvitation("org-1", "invitation-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
