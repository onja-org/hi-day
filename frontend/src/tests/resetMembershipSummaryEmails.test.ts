import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMembershipSummaryEmails } from "@/lib/resetMembershipSummaryEmails";

describe("resetMembershipSummaryEmails", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the audience's bulk-reset route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ cleared: 2, message: "Cleared 2 per-member overrides" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resetMembershipSummaryEmails("org-1", "team")).resolves.toEqual({
      ok: true,
      cleared: 2,
      message: "Cleared 2 per-member overrides",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/memberships/summary-emails/team/reset-overrides",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Forbidden." }),
      }),
    );

    await expect(
      resetMembershipSummaryEmails("org-1", "personal"),
    ).resolves.toEqual({ ok: false, message: "Forbidden." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(
      resetMembershipSummaryEmails("org-1", "personal"),
    ).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
