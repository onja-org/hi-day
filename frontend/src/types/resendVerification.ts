export type ResendVerificationInput = {
  email: string;
};

export type ResendVerificationResult =
  | { ok: true; message: string }
  | { ok: false; message: string };
