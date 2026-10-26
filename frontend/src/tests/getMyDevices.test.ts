import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyDevices } from "@/lib/getMyDevices";

describe("getMyDevices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the devices on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: "device-1", platform: "linux" }]),
      }),
    );

    const result = await getMyDevices();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.devices).toHaveLength(1);
      expect(result.devices[0].id).toBe("device-1");
    }
  });

  it("returns a generic error message when the response isn't ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    expect(await getMyDevices()).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    expect(await getMyDevices()).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
