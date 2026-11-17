import { afterEach, describe, expect, it, vi } from "vitest";
import { inviteMembers } from "@/lib/inviteMembers";

describe("inviteMembers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with per-entry results on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { email: "a@b.test", outcome: "sent" },
              {
                email: "bad",
                outcome: "invalid",
                message: "Invalid email format.",
              },
            ],
            message: "Invitations sent",
          }),
      }),
    );

    const result = await inviteMembers("org-1", [
      { email: "a@b.test", role: "member" },
      { email: "bad", role: "member" },
    ]);

    expect(result).toEqual({
      ok: true,
      results: [
        { email: "a@b.test", outcome: "sent" },
        { email: "bad", outcome: "invalid", message: "Invalid email format." },
      ],
      message: "Invitations sent",
    });
  });

  it("sends the admin's consent to an extra seat being charged on arrival", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [], message: "Invitations sent" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await inviteMembers("org-1", [{ email: "a@b.test", role: "member" }], {
      seatChargeConsent: true,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      invitations: [{ email: "a@b.test", role: "member" }],
      seatChargeConsent: true,
    });
  });

  it("sends no consent the admin didn't give", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [], message: "Invitations sent" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await inviteMembers("org-1", [{ email: "a@b.test", role: "member" }]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      invitations: [{ email: "a@b.test", role: "member" }],
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Forbidden." }),
      }),
    );

    const result = await inviteMembers("org-1", [
      { email: "a@b.test", role: "member" },
    ]);

    expect(result).toEqual({ ok: false, message: "Forbidden." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await inviteMembers("org-1", [
      { email: "a@b.test", role: "member" },
    ]);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
