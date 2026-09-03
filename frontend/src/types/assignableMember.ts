export type AssignableMember = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
};

export type GetAssignableMembersResult =
  | { ok: true; members: AssignableMember[] }
  | { ok: false; message: string };
