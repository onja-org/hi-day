import { afterEach, describe, expect, it, vi } from "vitest";
import { getInviteLinkPreview } from "@/lib/getInviteLinkPreview";

describe("getInviteLinkPreview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the preview for a token, URL-encoded", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "active", organisationName: "Acme", role: "member" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getInviteLinkPreview("a b");

    expect(fetchMock).toHaveBeenCalledWith("/api/backend/invite-links/a%20b", { method: "GET" });
    expect(result).toEqual({
      ok: true,
      preview: { status: "active", organisationName: "Acme", role: "member" },
    });
  });

  it("returns a generic error for a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect((await getInviteLinkPreview("t")).ok).toBe(false);
  });
});
