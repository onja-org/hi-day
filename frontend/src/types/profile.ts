export type MyProfile = {
  email: string;
  name: string | null;
};

export type GetMyProfileResult =
  | { ok: true; profile: MyProfile }
  | { ok: false; message: string };

export type UpdateMyProfileInput = {
  name: string;
};

export type UpdateMyProfileResult =
  | { ok: true; profile: MyProfile }
  | { ok: false; message: string };
