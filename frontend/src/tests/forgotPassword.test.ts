import { afterEach, describe, expect, it, vi } from "vitest";
import { forgotPassword } from "@/lib/forgotPassword";

describe("forgotPassword", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the backend's generic message on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            message:
              "If that email has an account, we've sent a password reset link.",
          }),
      }),
    );

    const result = await forgotPassword({ email: "jane@acme.test" });

    expect(result).toEqual({
      ok: true,
      message:
        "If that email has an account, we've sent a password reset link.",
    });
  });

  it("surfaces the first validation error message on a 400 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: ["email must be an email"] }),
      }),
    );

    const result = await forgotPassword({ email: "not-an-email" });

    expect(result).toEqual({
      ok: false,
      message: "email must be an email",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await forgotPassword({ email: "jane@acme.test" });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
