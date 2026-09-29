import { afterEach, describe, expect, it, vi } from "vitest";
import { requestInviteLinkJoin } from "@/lib/requestInviteLinkJoin";

describe("requestInviteLinkJoin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the email to the link's requests endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Check your inbox." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestInviteLinkJoin("tok", "a@x.com");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/invite-links/tok/requests",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "a@x.com" }) }),
    );
    expect(result).toEqual({ ok: true, message: "Check your inbox." });
  });

  it("surfaces a validation or throttling message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "email must be an email" }),
      }),
    );
    expect(await requestInviteLinkJoin("tok", "bad")).toEqual({
      ok: false,
      message: "email must be an email",
    });
  });
});
