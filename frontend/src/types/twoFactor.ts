import type { ApiResult } from "./api";

/** The signed-in person's own two-step login, from `GET /auth/two-factor`. */
export type TwoFactorStatus = {
  enabled: boolean;
  /** Unused recovery codes left; 0 while it is off. */
  recoveryCodesRemaining: number;
  /** Browsers told "don't ask again", which skip the code; 0 while it is off. */
  trustedBrowsers: number;
};

/** A secret to scan; it only takes effect once a code from it is confirmed. */
export type TwoFactorSetup = {
  /** For typing into the app by hand when the QR code can't be scanned. */
  secret: string;
  /** What the QR code encodes. */
  otpauthUrl: string;
};

export type TwoFactorStatusResult = ApiResult<{ status: TwoFactorStatus }>;
export type TwoFactorSetupResult = ApiResult<{ setup: TwoFactorSetup }>;
/** Turning it on, or renewing the set: the codes are shown this once only. */
export type RecoveryCodesResult = ApiResult<{ recoveryCodes: string[] }>;
export type TwoFactorChangeResult = ApiResult;

export type TwoFactorLoginResult = ApiResult<
  object,
  {
    /** Too many wrong codes: back to the password step, with a captcha. */
    captchaRequired?: boolean;
    /** The code step can't continue (timed out, or too many wrong codes). */
    restart?: boolean;
  }
>;
