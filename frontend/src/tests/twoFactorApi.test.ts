import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disableTwoFactor,
  enableTwoFactor,
  forgetTrustedBrowsers,
  getTwoFactorStatus,
  renewRecoveryCodes,
  startTwoFactorSetup,
} from "@/lib/twoFactorApi";

function respond(ok: boolean, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("twoFactorApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the status", async () => {
    respond(true, { enabled: true, recoveryCodesRemaining: 8, trustedBrowsers: 1 });
    expect(await getTwoFactorStatus()).toEqual({
      ok: true,
      message: "",
      status: { enabled: true, recoveryCodesRemaining: 8, trustedBrowsers: 1 },
    });
  });

  it("starts setup and returns the secret to scan", async () => {
    const fetchMock = respond(true, { secret: "ABC", otpauthUrl: "otpauth://totp/x" });
    const result = await startTwoFactorSetup();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/auth/two-factor/setup",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(result).toMatchObject({
      ok: true,
      setup: { secret: "ABC", otpauthUrl: "otpauth://totp/x" },
    });
  });

  it("posts the code to turn it on and returns the recovery codes", async () => {
    const fetchMock = respond(true, { recoveryCodes: ["AAAAA-BBBBB"], message: "On." });
    const result = await enableTwoFactor("123456");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/auth/two-factor/enable",
      expect.objectContaining({ body: JSON.stringify({ code: "123456" }) }),
    );
    expect(result).toEqual({ ok: true, recoveryCodes: ["AAAAA-BBBBB"], message: "On." });
  });

  it("posts the code to turn it off", async () => {
    const fetchMock = respond(true, { message: "Off." });
    expect(await disableTwoFactor("123456")).toEqual({ ok: true, message: "Off." });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/backend/auth/two-factor/disable");
  });

  it("posts the code to renew recovery codes", async () => {
    const fetchMock = respond(true, { recoveryCodes: ["CCCCC-DDDDD"], message: "New." });
    expect(await renewRecoveryCodes("123456")).toEqual({
      ok: true,
      recoveryCodes: ["CCCCC-DDDDD"],
      message: "New.",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/backend/auth/two-factor/recovery-codes");
  });

  it("forgets every trusted browser", async () => {
    const fetchMock = respond(true, { message: "Every browser will ask." });
    expect(await forgetTrustedBrowsers()).toEqual({ ok: true, message: "Every browser will ask." });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/backend/auth/two-factor/trusted-browsers");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  });

  it("surfaces the backend's message for a wrong code", async () => {
    respond(false, { message: "That code didn't work." });
    expect(await disableTwoFactor("000000")).toEqual({
      ok: false,
      message: "That code didn't work.",
    });
  });

  it("returns a generic error when the request can't be made", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await enableTwoFactor("123456")).ok).toBe(false);
  });
});
