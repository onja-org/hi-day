export type TimeActivityGrouping =
  | "none"
  | "day"
  | "week"
  | "project"
  | "member"
  | "team";

/** Membership id → names of the teams that member belongs to. */
export type MembershipTeamNames = Map<string, string[]>;
