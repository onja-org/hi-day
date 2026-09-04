import { afterEach, describe, expect, it, vi } from "vitest";
import { updateMyProfile } from "@/lib/updateMyProfile";

describe("updateMyProfile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the updated profile on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            email: "jane@acme.test",
            name: "Jane Smith",
            firstName: "Jane",
            lastName: "Smith",
            avatarUrl: null,
          }),
      }),
    );

    const result = await updateMyProfile({
      firstName: "Jane",
      lastName: "Smith",
    });

    expect(result).toEqual({
      ok: true,
      profile: {
        email: "jane@acme.test",
        name: "Jane Smith",
        firstName: "Jane",
        lastName: "Smith",
        avatarUrl: null,
      },
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "firstName must not be empty" }),
      }),
    );

    const result = await updateMyProfile({ firstName: "" });

    expect(result).toEqual({
      ok: false,
      message: "firstName must not be empty",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await updateMyProfile({ firstName: "Jane" });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
