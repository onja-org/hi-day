import { SCREENSHOT_HIGHLIGHT_KEYS } from "./parseScreenshotHighlight";

const DAY_MS = 24 * 60 * 60 * 1000;

type InstanceLinkInput = {
  organisationId: string;
  /** Omitted for your own Insights; the linked pages then show your own data too. */
  membershipId?: string;
  /** The instance's start and end instants. */
  start: string;
  end: string;
  /** The instance's day on the organisation's calendar. */
  date: string;
  now: Date;
};

/**
 * Where to check an instance: the member's Screenshots for that day, opened
 * on the instance's stretch and highlighting it, and their Timesheet for it. Screenshots navigates in UTC days back from today
 * (see `getDayRangeDateString`), so its offset comes from the instance's
 * own start time; the Timesheet takes the organisation-calendar day.
 */
export function buildUnusualInstanceLinks(input: InstanceLinkInput): {
  screenshots: string;
  timesheet: string;
} {
  const utcDay = (instant: Date) =>
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate());
  const dayOffset = Math.round((utcDay(new Date(input.start)) - utcDay(input.now)) / DAY_MS);

  const screenshots = new URLSearchParams();
  if (input.membershipId) screenshots.set("membershipId", input.membershipId);
  if (dayOffset !== 0) screenshots.set("day", String(dayOffset));
  const [fromKey, toKey] = SCREENSHOT_HIGHLIGHT_KEYS;
  screenshots.set(fromKey, input.start);
  screenshots.set(toKey, input.end);

  const timesheet = new URLSearchParams();
  if (input.membershipId) timesheet.set("member", input.membershipId);
  timesheet.set("date", input.date);

  const base = `/organisations/${input.organisationId}`;
  return {
    screenshots: `${base}/activities/screenshots?${screenshots.toString()}`,
    timesheet: `${base}/time_entries?${timesheet.toString()}`,
  };
}
