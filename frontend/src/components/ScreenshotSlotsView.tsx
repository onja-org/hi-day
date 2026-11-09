"use client";

import { useState } from "react";
import { useScreenshotSlots } from "@/hooks/useScreenshotSlots";
import { SLOT_HOURS_PAGE_SIZE } from "@/lib/getScreenshotSlots";
import { ActivityQueryStatus } from "./ActivityQueryStatus";
import { Pagination } from "./Pagination";
import { ScreenshotSlotHourSection } from "./ScreenshotSlotHourSection";
import { ScreenshotSlotsLegend } from "./ScreenshotSlotsLegend";
import { ScreenshotSlotsSummary } from "./ScreenshotSlotsSummary";

type ScreenshotSlotsViewProps = {
  organisationId: string;
  date: string;
  membershipId?: string;
  projectId?: string;
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
}: ScreenshotSlotsViewProps) {
  // Derived rather than reset in an effect, like the gallery.
  const dayKey = [date, membershipId, projectId].join("|");
  const [paging, setPaging] = useState({ dayKey, page: 1 });
  const requestedPage = paging.dayKey === dayKey ? paging.page : 1;

  const slotsQuery = useScreenshotSlots(
    organisationId,
    { date, membershipId, projectId },
    { page: requestedPage },
  );

  const day = slotsQuery.data;
  const hours = day?.hours ?? [];

  return (
    <div className="flex flex-col gap-6">
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
