export type AssignableTeam = {
  id: string;
  name: string;
};

export type GetAssignableTeamsResult =
  | { ok: true; teams: AssignableTeam[] }
  | { ok: false; message: string };
