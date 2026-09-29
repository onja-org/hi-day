import { afterEach, describe, expect, it, vi } from "vitest";
import { getInvitationPreview } from "@/lib/getInvitationPreview";

describe("getInvitationPreview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the preview on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "pending",
            email: "invitee@acme.test",
            organisationName: "Acme Inc",
            role: "member",
            teamNames: [],
            accountAlreadyExists: false,
          }),
      }),
    );

    const result = await getInvitationPreview("the-token");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.status).toBe("pending");
      expect(result.preview.email).toBe("invitee@acme.test");
    }
  });

  it("returns a generic error message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await getInvitationPreview("bad-token");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getInvitationPreview("the-token");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
