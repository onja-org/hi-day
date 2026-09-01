export type ForgotPasswordInput = {
  email: string;
};

export type ForgotPasswordResult =
  | { ok: true; message: string }
  | { ok: false; message: string };
