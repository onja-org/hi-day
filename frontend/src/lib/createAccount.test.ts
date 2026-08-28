import { afterEach, describe, expect, it, vi } from "vitest";
import { createAccount } from "./createAccount";
import type { CreateAccountInput } from "@/types/account";

const validInput: CreateAccountInput = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@acme.test",
  companyName: "Acme Inc",
  address: "1 Main St, Springfield",
};

describe("createAccount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the backend message on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ message: "Check your email." }),
      }),
    );

    const result = await createAccount(validInput);

    expect(result).toEqual({ ok: true, message: "Check your email." });
  });

  it("surfaces the first validation error message on a 400 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            message: ["email must be an email"],
          }),
      }),
    );

    const result = await createAccount(validInput);

    expect(result).toEqual({
      ok: false,
      message: "email must be an email",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await createAccount(validInput);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });

  it("returns a generic error message on an unexpected server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const result = await createAccount(validInput);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
