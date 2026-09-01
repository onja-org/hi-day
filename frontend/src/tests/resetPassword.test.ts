import { afterEach, describe, expect, it, vi } from "vitest";
import { resetPassword } from "@/lib/resetPassword";

describe("resetPassword", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the backend message on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Password reset. You are now signed in.",
          }),
      }),
    );

    const result = await resetPassword({
      token: "valid-token",
      password: "correct-horse",
    });

    expect(result).toEqual({
      ok: true,
      message: "Password reset. You are now signed in.",
    });
  });

  it("returns the backend's error message when the link is invalid or expired", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "This link is invalid or has expired." }),
      }),
    );

    const result = await resetPassword({
      token: "expired-token",
      password: "correct-horse",
    });

    expect(result).toEqual({
      ok: false,
      message: "This link is invalid or has expired.",
    });
  });

  it("surfaces the first validation error message on a 400 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: ["password must be longer than 6 characters"],
          }),
      }),
    );

    const result = await resetPassword({
      token: "valid-token",
      password: "short",
    });

    expect(result).toEqual({
      ok: false,
      message: "password must be longer than 6 characters",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await resetPassword({
      token: "valid-token",
      password: "correct-horse",
    });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
