import { API_URL } from "./apiUrl";
import type { GetTimeEntriesResult, TimeEntryListItem } from "@/types/timeEntry";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

// Set by the backend when older entries remain past the page it returned.
const NEXT_CURSOR_HEADER = "X-Next-Cursor";

export type GetTimeEntriesFilter = {
  membershipId?: string;
  from?: Date;
  to?: Date;
};

/**
 * A member's time entries, newest first. With both `from` and `to` it
 * returns every entry in that range, following the API's pages: a timesheet
 * or report has to see the whole range, or its totals come out short.
 * Without a full range it returns just the newest page, a recent-history
 * glance that shouldn't pull someone's whole history.
 */
export async function getTimeEntries(
  organisationId: string,
  filter: GetTimeEntriesFilter = {},
): Promise<GetTimeEntriesResult> {
  const followPages = Boolean(filter.from && filter.to);
  const entries: TimeEntryListItem[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = await fetchPage(organisationId, filter, cursor);
    if (!page.ok) return page;
    entries.push(...page.entries);
    cursor = followPages ? page.nextCursor : null;
    // A cursor seen twice would loop forever; stop rather than hang.
    if (cursor && seenCursors.has(cursor)) cursor = null;
    if (cursor) seenCursors.add(cursor);
  } while (cursor);

  return { ok: true, entries };
}

type PageResult =
  | { ok: true; entries: TimeEntryListItem[]; nextCursor: string | null }
  | { ok: false; message: string };

async function fetchPage(
  organisationId: string,
  filter: GetTimeEntriesFilter,
  cursor: string | null,
): Promise<PageResult> {
  const params = new URLSearchParams();
  if (filter.membershipId) params.set("membershipId", filter.membershipId);
  if (filter.from) params.set("from", filter.from.toISOString());
  if (filter.to) params.set("to", filter.to.toISOString());
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/time-entries${query ? `?${query}` : ""}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const entries = (await response.json()) as TimeEntryListItem[];
    return {
      ok: true,
      entries,
      nextCursor: response.headers.get(NEXT_CURSOR_HEADER),
    };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
