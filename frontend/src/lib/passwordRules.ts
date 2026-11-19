/** Mirrors the backend's password policy (`backend/src/auth/dto/password-policy.ts`), which is the one that decides. Shown under every new-password field before anyone types. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_RULES_HINT = `At least ${PASSWORD_MIN_LENGTH} characters. Avoid common passwords and your email address.`;
