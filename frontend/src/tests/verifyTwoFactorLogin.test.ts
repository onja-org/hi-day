import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTwoFactorLogin } from "@/lib/verifyTwoFactorLogin";

describe("verifyTwoFactorLogin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the code and returns ok on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Logged in." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await verifyTwoFactorLogin({ code: "123456", rememberBrowser: true })).toEqual({ ok: true, message: "Logged in." });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/auth/login/two-factor",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ code: "123456", rememberBrowser: true }),
      }),
    );
  });

  it("reports a wrong code without asking to start again", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "That code didn't work." }),
      }),
    );

    expect(await verifyTwoFactorLogin({ code: "000000", rememberBrowser: false })).toEqual({
      ok: false,
      message: "That code didn't work.",
      captchaRequired: false,
      restart: false,
    });
  });

  it("passes on that the password step must be repeated, with a captcha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "Too many wrong codes.", captchaRequired: true, restart: true }),
      }),
    );

    expect(await verifyTwoFactorLogin({ code: "000000", rememberBrowser: false })).toMatchObject({
      ok: false,
      captchaRequired: true,
      restart: true,
    });
  });

  it("returns a generic error when the request can't be made", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await verifyTwoFactorLogin({ code: "123456", rememberBrowser: true })).ok).toBe(false);
  });
});
