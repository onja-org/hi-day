/** One app or website's time in one project on one day — what the Apps & URLs report is built from. */
export type AppsUrlsItem = {
  /** The day, "2026-10-05". */
  dateKey: string;
  projectId: string | null;
  projectName: string;
  /** App name, or the site's host. */
  label: string;
  kind: "app" | "site";
  seconds: number;
  /** Whose activity it is: "me" for the viewer's own, else the membership id. */
  memberId: string;
  memberName: string;
};

/** Whose activity to fetch. `membershipId` is undefined for the viewer's own. */
export type AppsUrlsMember = {
  /** "me" for the viewer's own, else the membership id. */
  key: string;
  membershipId: string | undefined;
  name: string;
};

/** One member's activity summary for one day. */
export type AppsUrlsMemberDay<T> = { member: AppsUrlsMember; day: T };

export type AppsUrlsGrouping = "date" | "project" | "member";

/** Every column the report can show besides time: the groupings, plus the app or site, which is always a detail. */
export type AppsUrlsDimension = AppsUrlsGrouping | "app";
