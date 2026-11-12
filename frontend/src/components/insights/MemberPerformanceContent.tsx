"use client";

import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { useMemberPerformance } from "@/hooks/useMemberPerformance";
import { ActivityCard } from "./ActivityCard";
import { FocusTimeCard } from "./FocusTimeCard";
import { IdleTimeCard } from "./IdleTimeCard";
import { InsightsMemberHeader } from "./InsightsMemberHeader";
import { StartStopCard } from "./StartStopCard";
import { UtilizationCard } from "./UtilizationCard";
import { WorkTimeClassificationCard } from "./WorkTimeClassificationCard";

type MemberPerformanceContentProps = {
  organisationId: string;
};

/**
 * Insights → Performance: one member's six cards, each against the team and
 * organisation averages. When activity is hidden from you about yourself,
 * the two cards read off it are left out altogether rather than explained.
 * The Remote vs in-office tab waits for that setting to exist.
 */
export function MemberPerformanceContent({ organisationId }: MemberPerformanceContentProps) {
  const { membershipId, fromKey, toKey } = useInsightsFilters();
  const performanceQuery = useMemberPerformance(organisationId, {
    membershipId,
    from: fromKey,
    to: toKey,
  });

  const memberLabel = membershipId === undefined ? "You" : "This member";

  return (
    <div className="flex flex-col gap-6">
      <InsightsMemberHeader organisationId={organisationId} title="Performance" page="performance" />
      {performanceQuery.isPending && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading…
        </p>
      )}
      {performanceQuery.isError && <ErrorMessage message={performanceQuery.error.message} />}
      {performanceQuery.isSuccess && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UtilizationCard
            report={performanceQuery.data}
            memberLabel={memberLabel}
          />
          <WorkTimeClassificationCard />
          {performanceQuery.data.activityStatus !== "hidden" && (
            <>
              <FocusTimeCard
                report={performanceQuery.data}
                memberLabel={memberLabel}
              />
              <ActivityCard
                report={performanceQuery.data}
                memberLabel={memberLabel}
              />
            </>
          )}
          <StartStopCard
            report={performanceQuery.data}
            memberLabel={memberLabel}
          />
          <IdleTimeCard
            report={performanceQuery.data}
            memberLabel={memberLabel}
          />
        </div>
      )}
    </div>
  );
}
