import { afterEach, describe, expect, it, vi } from "vitest";
import { login } from "@/lib/login";

describe("login", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the backend message on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Logged in." }),
      }),
    );

    const result = await login({
      email: "jane@acme.test",
      password: "correct-horse",
    });

    expect(result).toEqual({ ok: true, message: "Logged in." });
  });

  it("returns the generic invalid-login message on failure without revealing why", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Invalid email or password." }),
      }),
    );

    const result = await login({
      email: "unknown@acme.test",
      password: "whatever",
    });

    expect(result).toEqual({
      ok: false,
      message: "Invalid email or password.",
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

    const result = await login({
      email: "not-an-email",
      password: "correct-horse",
    });

    expect(result).toEqual({
      ok: false,
      message: "email must be an email",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await login({
      email: "jane@acme.test",
      password: "correct-horse",
    });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
