import { afterEach, describe, expect, it, vi } from "vitest";
import { getInviteLinks } from "@/lib/getInviteLinks";

describe("getInviteLinks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the organisation's links on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "l-1" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getInviteLinks("org-1");

    expect(result).toEqual({ ok: true, inviteLinks: [{ id: "l-1" }] });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/invite-links",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("surfaces the backend's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: "Nope" }) }),
    );
    expect(await getInviteLinks("org-1")).toEqual({ ok: false, message: "Nope" });
  });

  it("returns a generic error when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await getInviteLinks("org-1")).ok).toBe(false);
  });
});
