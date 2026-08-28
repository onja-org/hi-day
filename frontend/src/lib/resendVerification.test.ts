import { afterEach, describe, expect, it, vi } from "vitest";
import { resendVerification } from "./resendVerification";

describe("resendVerification", () => {
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
            message:
              "If that email is awaiting verification, we've sent a new link.",
          }),
      }),
    );

    const result = await resendVerification({ email: "jane@acme.test" });

    expect(result).toEqual({
      ok: true,
      message: "If that email is awaiting verification, we've sent a new link.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await resendVerification({ email: "jane@acme.test" });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
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

    const result = await resendVerification({ email: "not-an-email" });

    expect(result).toEqual({
      ok: false,
      message: "email must be an email",
    });
  });
});
