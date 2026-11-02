import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicConfig } from "@/lib/getPublicConfig";

afterEach(() => vi.unstubAllGlobals());

function respondWith(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("asking the backend what this installation is", () => {
  it("reads billing on from Hi Day Cloud", async () => {
    respondWith({ billingEnabled: true });

    await expect(getPublicConfig()).resolves.toEqual({ billingEnabled: true });
  });

  it("reads billing off from a self-hosted install", async () => {
    respondWith({ billingEnabled: false });

    await expect(getPublicConfig()).resolves.toEqual({ billingEnabled: false });
  });

  it("asks the config endpoint through the proxy", async () => {
    const fetchMock = respondWith({ billingEnabled: true });

    await getPublicConfig();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/config",
      expect.objectContaining({ method: "GET" }),
    );
  });

  /**
   * Never throws. A backend that is down, or one too old to have this
   * endpoint, must not break every page that asks — and the safe guess is
   * no billing.
   */
  it("says billing is off when the backend refuses", async () => {
    respondWith({ billingEnabled: true }, false);

    await expect(getPublicConfig()).resolves.toEqual({
      billingEnabled: false,
    });
  });

  it("says billing is off when the backend cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(getPublicConfig()).resolves.toEqual({
      billingEnabled: false,
    });
  });
});
