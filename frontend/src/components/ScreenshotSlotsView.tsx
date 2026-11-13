"use client";

import { useEffect, useRef, useState } from "react";
import { useScreenshotSlots } from "@/hooks/useScreenshotSlots";
import { SLOT_HOURS_PAGE_SIZE } from "@/lib/getScreenshotSlots";
import type { ScreenshotHighlight } from "@/types/screenshot";
import { ActivityQueryStatus } from "./ActivityQueryStatus";
import { Pagination } from "./Pagination";
import { ScreenshotSlotHourSection } from "./ScreenshotSlotHourSection";
import { ScreenshotSlotsHighlightNote } from "./ScreenshotSlotsHighlightNote";
import { ScreenshotSlotsLegend } from "./ScreenshotSlotsLegend";
import { ScreenshotSlotsSummary } from "./ScreenshotSlotsSummary";

type ScreenshotSlotsViewProps = {
  organisationId: string;
  date: string;
  membershipId?: string;
  projectId?: string;
  /** A stretch a link asked to point out: opened on, ringed and scrolled to. */
  highlight: ScreenshotHighlight | null;
};

/**
 * The day in 10-minute slots, grouped and paged by the hour. Hours with
 * nothing tracked never arrive — the server drops them before paging, so no
 * page is ever blank.
 */
export function ScreenshotSlotsView({
  organisationId,
  date,
  membershipId,
  projectId,
  highlight,
}: ScreenshotSlotsViewProps) {
  // Derived rather than reset in an effect, like the gallery. No page picked
  // yet means "wherever the highlight is", or page 1 without one.
  const dayKey = [date, membershipId, projectId].join("|");
  const [paging, setPaging] = useState<{ dayKey: string; page?: number }>({ dayKey });
  const requestedPage = paging.dayKey === dayKey ? paging.page : undefined;

  const slotsQuery = useScreenshotSlots(
    organisationId,
    { date, membershipId, projectId },
    { page: requestedPage, at: highlight?.from },
  );

  const day = slotsQuery.data;
  const hours = day?.hours ?? [];

  // Once, when the highlighted stretch first appears — not on every poll.
  const containerRef = useRef<HTMLDivElement>(null);
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!highlight || scrolledTo.current === highlight.from) return;
    const first = containerRef.current?.querySelector("[data-highlighted]");
    if (!first) return;
    scrolledTo.current = highlight.from;
    first.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight, day]);

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      {highlight && <ScreenshotSlotsHighlightNote highlight={highlight} />}
      <ActivityQueryStatus
        isLoading={slotsQuery.isLoading}
        isError={slotsQuery.isError}
        error={slotsQuery.error}
        loadingLabel="Loading the day…"
        errorFallback="Could not load this day."
      />

      {day && <ScreenshotSlotsSummary day={day} />}
      {day && day.totalHours > 0 && <ScreenshotSlotsLegend />}

      {day && day.totalHours === 0 && (
        <p className="text-slate-900">
          {projectId
            ? "No time was tracked against this project on this day."
            : "No time was tracked on this day."}
        </p>
      )}

      {hours.map((hour) => (
        <ScreenshotSlotHourSection
          key={hour.start}
          organisationId={organisationId}
          hour={hour}
          activityRecorded={day?.activityRecorded ?? true}
          screenshotsEnabled={day?.screenshotsEnabled ?? false}
          highlight={highlight}
        />
      ))}

      {day && (
        <Pagination
          label="Hour pages"
          page={day.page}
          pageSize={day.pageSize || SLOT_HOURS_PAGE_SIZE}
          total={day.totalHours}
          isFetching={slotsQuery.isPlaceholderData}
          onPageChange={(page) => setPaging({ dayKey, page })}
        />
      )}
    </div>
  );
}
