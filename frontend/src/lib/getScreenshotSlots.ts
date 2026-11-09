import { API_URL } from "./apiUrl";
import type {
  GetScreenshotSlotsResult,
  ScreenshotSlotsDay,
} from "@/types/screenshot";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type GetScreenshotSlotsFilter = {
  date?: string;
  membershipId?: string;
  projectId?: string;
};

/** Which page of the day's hours to ask for. */
export type ScreenshotSlotsPaging = {
  /** 1-based; defaults to 1. */
  page?: number;
};

/** Hours per page — mirrors the backend's own default. */
export const SLOT_HOURS_PAGE_SIZE = 4;

function basePath(membershipId?: string): string {
  return membershipId
    ? `memberships/${membershipId}/screenshots/slots`
    : "screenshots/slots/mine";
}

async function errorMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return message ?? GENERIC_ERROR_MESSAGE;
}

/**
 * A member's day as 10-minute slots — the caller's own without
 * `membershipId`, today without `date`.
 *
 * Paged by **hour**, since a slot belongs to one and an hour is the
 * smallest unit a page can be cut on without splitting a row. The day's own
 * Worked time and Avg. activity cover the whole day whatever page is
 * showing; only the hours do.
 */
export async function getScreenshotSlots(
  organisationId: string,
  filter: GetScreenshotSlotsFilter = {},
  paging: ScreenshotSlotsPaging = {},
): Promise<GetScreenshotSlotsResult> {
  const params = new URLSearchParams();
  if (filter.date) params.set("date", filter.date);
  if (filter.projectId) params.set("projectId", filter.projectId);
  params.set("page", String(paging.page ?? 1));
  params.set("pageSize", String(SLOT_HOURS_PAGE_SIZE));

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/${basePath(filter.membershipId)}?${params.toString()}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, day: (await response.json()) as ScreenshotSlotsDay };
  }
  return { ok: false, message: await errorMessage(response) };
}
