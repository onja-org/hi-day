const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type TimesheetLink = {
  /** "" for your own timesheet, as the page's member picker uses it. */
  membershipId: string;
  /** A single day to open on, on the organisation's calendar; `null` to keep the default. */
  date: string | null;
};

/**
 * What a link into the Timesheet asks for — `?member=&date=` — read once as
 * the page's starting point. Anything malformed is ignored rather than
 * breaking the page.
 */
export function parseTimesheetLink(searchParams: URLSearchParams): TimesheetLink {
  const date = searchParams.get("date");
  return {
    membershipId: searchParams.get("member") ?? "",
    date: date && DATE_KEY.test(date) ? date : null,
  };
}
