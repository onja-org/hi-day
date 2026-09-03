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
          Promise.resolve([
            { email: "a@b.test", outcome: "sent" },
            { email: "bad", outcome: "invalid", message: "Invalid email format." },
          ]),
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
