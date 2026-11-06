import { afterEach, describe, expect, it, vi } from "vitest";
import { setAutoRenew } from "@/lib/subscriptionApi";

describe("setAutoRenew", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["cancels", false],
    ["keeps", true],
  ])("%s the renewal with a PUT to auto-renew", async (_, on) => {
    const subscription = { plan: "annual", cancelAtPeriodEnd: !on };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(subscription),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await setAutoRenew("12", on);

    expect(result).toEqual({ ok: true, data: subscription });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/12/billing/auto-renew",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ on }) }),
    );
  });

  it("surfaces the server's reason when it refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "This subscription has already ended. Subscribe again to carry on.",
          }),
      }),
    );

    const result = await setAutoRenew("12", false);

    expect(result).toEqual({
      ok: false,
      message: "This subscription has already ended. Subscribe again to carry on.",
    });
  });

  it("returns a generic message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await setAutoRenew("12", false);

    expect(result).toEqual({ ok: false, message: "Something went wrong. Please try again." });
  });
});
