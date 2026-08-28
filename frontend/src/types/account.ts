export type CreateAccountInput = {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  address: string;
  website?: string;
};

export type CreateAccountResult =
  | { ok: true; message: string }
  | { ok: false; message: string };
