export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult =
  | { ok: true; message: string }
  | { ok: false; message: string };
