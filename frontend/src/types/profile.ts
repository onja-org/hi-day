export type MyProfile = {
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

export type GetMyProfileResult =
  | { ok: true; profile: MyProfile }
  | { ok: false; message: string };

export type UpdateMyProfileInput = {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
};

export type UpdateMyProfileResult =
  | { ok: true; profile: MyProfile }
  | { ok: false; message: string };
