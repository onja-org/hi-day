import { afterEach, describe, expect, it, vi } from "vitest";
import { unsubscribeSummaryEmail } from "@/lib/unsubscribeSummaryEmail";

describe("unsubscribeSummaryEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the token without credentials and names what was turned off", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ kind: "team-daily", organisationName: "Acme" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(unsubscribeSummaryEmail("tok")).resolves.toEqual({
      ok: true,
      message: "Summary email turned off",
      kind: "team-daily",
      organisationName: "Acme",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/summary-emails/unsubscribe",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "tok" }),
      }),
    );
  });

  it("surfaces the backend's error message for a bad link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "This link is not valid." }),
      }),
    );

    await expect(unsubscribeSummaryEmail("bad")).resolves.toEqual({
      ok: false,
      message: "This link is not valid.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(unsubscribeSummaryEmail("tok")).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
