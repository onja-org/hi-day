"use client";

import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { useMemberTimeline } from "@/hooks/useMemberTimeline";
import { InsightsMemberHeader } from "./InsightsMemberHeader";
import { TimelineLegend } from "./TimelineLegend";
import { TimelineDayRow } from "./TimelineDayRow";

type MemberTimelineContentProps = {
  organisationId: string;
};

/** Insights → Timeline: one member's days as bars of tracked, manual and idle time. */
export function MemberTimelineContent({ organisationId }: MemberTimelineContentProps) {
  const { membershipId, fromKey, toKey } = useInsightsFilters();
  const timelineQuery = useMemberTimeline(organisationId, {
    membershipId,
    from: fromKey,
    to: toKey,
  });

  return (
    <div className="flex flex-col gap-6">
      <InsightsMemberHeader organisationId={organisationId} title="Timeline" page="timeline" />
      <section className="flex flex-col gap-3 rounded-brand-sm border border-input-border bg-white p-4">
        {timelineQuery.isPending && (
          <p className="flex items-center gap-2 text-slate-900">
            <Spinner className="text-primary-dark" />
            Loading…
          </p>
        )}
        {timelineQuery.isError && <ErrorMessage message={timelineQuery.error.message} />}
        {timelineQuery.isSuccess && (
          <>
            <TimelineLegend
              activityRecorded={timelineQuery.data.activityStatus === "recorded"}
              showActivity={timelineQuery.data.activityStatus !== "hidden"}
            />
            <ul className="divide-y divide-input-border">
              {timelineQuery.data.days.map((day) => (
                <TimelineDayRow
                  key={day.date}
                  day={day}
                  zone={timelineQuery.data.timezone}
                  showActivity={timelineQuery.data.activityStatus !== "hidden"}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
