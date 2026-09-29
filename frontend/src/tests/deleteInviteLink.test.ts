import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteInviteLink } from "@/lib/deleteInviteLink";

describe("deleteInviteLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("DELETEs the link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Invite link deleted" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteInviteLink("org-1", "l-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/invite-links/l-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(result).toEqual({ ok: true, message: "Invite link deleted" });
  });

  it("returns a generic error when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await deleteInviteLink("org-1", "l-1")).ok).toBe(false);
  });
});
