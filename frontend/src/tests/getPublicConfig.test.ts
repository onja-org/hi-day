import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicConfig } from "@/lib/getPublicConfig";

afterEach(() => vi.unstubAllGlobals());

function respondWith(body: unknown, ok = true) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok, json: () => Promise.resolve(body) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("asking the backend what this installation is", () => {
  it("reads the answer, through the proxy", async () => {
    const fetchMock = respondWith({ billingEnabled: true });

    await expect(getPublicConfig()).resolves.toEqual({ billingEnabled: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/config",
      expect.objectContaining({ method: "GET" }),
    );
  });

  /** Never throws: a backend that is down, or too old to have this endpoint,
   * must not break every page that asks. */
  it("says billing is off when the backend refuses or cannot be reached", async () => {
    respondWith({ billingEnabled: true }, false);
    await expect(getPublicConfig()).resolves.toEqual({ billingEnabled: false });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(getPublicConfig()).resolves.toEqual({ billingEnabled: false });
  });
});
