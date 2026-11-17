import { activityDayKey } from "./activityDayKey";
import { daysBetweenKeys } from "./daysBetweenKeys";
import { SCREENSHOT_HIGHLIGHT_KEYS } from "./parseScreenshotHighlight";

type InstanceLinkInput = {
  organisationId: string;
  /** Omitted for your own Insights; the linked pages then show your own data too. */
  membershipId?: string;
  /** The instance's start and end instants. */
  start: string;
  end: string;
  /** The instance's day on the organisation's calendar. */
  date: string;
  /** The organisation's timezone, whose calendar `date` is on. */
  timezone: string;
  now: Date;
};

/**
 * Where to check an instance: the member's Screenshots for that day, opened
 * on the instance's stretch and highlighting it, and their Timesheet for it.
 * Both read days on the organisation's calendar: Screenshots counts back
 * from today there (see `activityDayKey`), the Timesheet takes the day.
 */
export function buildUnusualInstanceLinks(input: InstanceLinkInput): {
  screenshots: string;
  timesheet: string;
} {
  const dayOffset = daysBetweenKeys(
    activityDayKey(input.now, input.timezone),
    input.date,
  );

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
