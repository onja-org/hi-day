import { afterEach, describe, expect, it, vi } from "vitest";
import { saveInviteLink } from "@/lib/saveInviteLink";

function okFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ inviteLink: { id: "l-1" }, message: "Invite link created" }),
  });
}

describe("saveInviteLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs a new link when there's no link id", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveInviteLink("org-1", { name: "Onboarding" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/invite-links",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Onboarding" }) }),
    );
    expect(result).toEqual({ ok: true, inviteLink: { id: "l-1" }, message: "Invite link created" });
  });

  it("PATCHes an existing link", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    await saveInviteLink("org-1", { enabled: false }, "l-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/invite-links/l-1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("surfaces the backend's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "You can only add teams you manage to an invite link." }),
      }),
    );
    expect(await saveInviteLink("org-1", {})).toEqual({
      ok: false,
      message: "You can only add teams you manage to an invite link.",
    });
  });
});
