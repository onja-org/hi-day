import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevicePairing } from "@/lib/getDevicePairing";

describe("getDevicePairing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the summary on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            platform: "linux",
            hostname: "janes-laptop",
            requestedAt: "2026-01-01T00:00:00.000Z",
          }),
      }),
    );

    const result = await getDevicePairing("the-code");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.platform).toBe("linux");
      expect(result.summary.hostname).toBe("janes-laptop");
    }
  });

  it("returns an invalid-link message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await getDevicePairing("bad-code");

    expect(result).toEqual({
      ok: false,
      message: "This link is invalid or has expired.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getDevicePairing("the-code");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
