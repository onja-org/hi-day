export type SetPasswordInput = {
  token: string;
  password: string;
};

export type SetPasswordResult =
  | { ok: true; message: string }
  | { ok: false; message: string };
