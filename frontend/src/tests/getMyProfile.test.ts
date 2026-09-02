import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyProfile } from "@/lib/getMyProfile";

describe("getMyProfile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the profile on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ email: "jane@acme.test", name: "Jane Doe" }),
      }),
    );

    const result = await getMyProfile();

    expect(result).toEqual({
      ok: true,
      profile: { email: "jane@acme.test", name: "Jane Doe" },
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Not authenticated." }),
      }),
    );

    const result = await getMyProfile();

    expect(result).toEqual({ ok: false, message: "Not authenticated." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getMyProfile();

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
