export type ResetPasswordInput = {
  token: string;
  password: string;
};

export type ResetPasswordResult =
  | { ok: true; message: string }
  | { ok: false; message: string };
