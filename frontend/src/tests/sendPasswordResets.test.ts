import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPasswordResets } from "@/lib/sendPasswordResets";

describe("sendPasswordResets", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the membership ids and returns per-member results", async () => {
    const results = [{ membershipId: "m-1", email: "a@x.com", outcome: "sent" }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results, message: "Password reset emails sent" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendPasswordResets("org-1", ["m-1"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/memberships/password-resets",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ membershipIds: ["m-1"] }),
      }),
    );
    expect(result).toEqual({ ok: true, results, message: "Password reset emails sent" });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Too many requests" }),
      }),
    );

    expect(await sendPasswordResets("org-1", ["m-1"])).toEqual({
      ok: false,
      message: "Too many requests",
    });
  });

  it("returns a generic error when the request can't be made", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await sendPasswordResets("org-1", ["m-1"]);
    expect(result.ok).toBe(false);
  });
});
