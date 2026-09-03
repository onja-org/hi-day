import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptInvitation } from "@/lib/acceptInvitation";

describe("acceptInvitation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Welcome to Acme Inc." }),
      }),
    );

    const result = await acceptInvitation("the-token", { password: "Password1", firstName: "Jane", lastName: "Doe" });

    expect(result).toEqual({ ok: true, message: "Welcome to Acme Inc." });
  });

  it("flags accountExists when the backend returns the ACCOUNT_EXISTS code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ code: "ACCOUNT_EXISTS", message: "..." }),
      }),
    );

    const result = await acceptInvitation("the-token");

    expect(result).toEqual({
      ok: false,
      accountExists: true,
      message:
        "An account already exists for this email. Log in to accept this invitation.",
    });
  });

  it("surfaces the backend's error message for an invalid/expired token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "This link is invalid or has expired." }),
      }),
    );

    const result = await acceptInvitation("the-token", { password: "Password1", firstName: "Jane", lastName: "Doe" });

    expect(result).toEqual({
      ok: false,
      message: "This link is invalid or has expired.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await acceptInvitation("the-token", { password: "Password1", firstName: "Jane", lastName: "Doe" });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
