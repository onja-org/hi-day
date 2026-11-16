"use client";

import { useQuery } from "@tanstack/react-query";
import { differsOnlyByPage } from "@/lib/differsOnlyByPage";
import { getScreenshotSlots } from "@/lib/getScreenshotSlots";
import type {
  GetScreenshotSlotsFilter,
  ScreenshotSlotsPaging,
} from "@/lib/getScreenshotSlots";

/** The page number is always last — `differsOnlyByPage` relies on it. */
export const SCREENSHOT_SLOTS_QUERY_KEY = (
  organisationId: string,
  filter: GetScreenshotSlotsFilter = {},
  paging: ScreenshotSlotsPaging = {},
) => [
  "screenshots",
  "slots",
  organisationId,
  filter.membershipId ?? "self",
  filter.date ?? null,
  filter.projectId ?? "all",
  paging.page === undefined ? (paging.at ?? null) : null,
  paging.page ?? 1,
];

/** The agent's own upload cadence — nothing reaches the server faster. */
const SLOTS_POLL_INTERVAL_MS = 60_000;

export function useScreenshotSlots(
  organisationId: string,
  filter: GetScreenshotSlotsFilter = {},
  paging: ScreenshotSlotsPaging = {},
  options: { enabled?: boolean } = {},
) {
  const queryKey = SCREENSHOT_SLOTS_QUERY_KEY(organisationId, filter, paging);
  // A past day's slots are settled and cannot move.
  const isToday =
    filter.date === undefined ||
    filter.date === new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey,
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const result = await getScreenshotSlots(organisationId, filter, paging);
      if (!result.ok) throw new Error(result.message);
      return result.day;
    },
    // Keeps the hours up until the next page arrives rather than blanking
    // to a spinner, like the gallery. A different day starts from one.
    placeholderData: (previous, previousQuery) =>
      previousQuery && differsOnlyByPage(previousQuery.queryKey, queryKey)
        ? previous
        : undefined,
    /**
     * Polled, unlike the Apps tab beside it: this view says "Measuring…"
     * for a figure not yet in, and fetched once that promise never
     * resolves. The re-render also re-reads the clock, which is what lets a
     * slot that was never measured stop claiming to be in progress.
     */
    refetchInterval: isToday ? SLOTS_POLL_INTERVAL_MS : false,
  });
}
