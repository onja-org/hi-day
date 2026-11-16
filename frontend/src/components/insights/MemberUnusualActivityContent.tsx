"use client";

import { useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { useMemberUnusualActivity } from "@/hooks/useMemberUnusualActivity";
import type { UnusualSeverity } from "@/types/unusualActivity";
import { InsightsMemberHeader } from "./InsightsMemberHeader";
import { UnusualActivityResults } from "./UnusualActivityResults";

type MemberUnusualActivityContentProps = {
  organisationId: string;
};

const ALL_SEVERITIES: UnusualSeverity[] = ["highly_unusual", "unusual", "slightly_unusual"];

/**
 * Insights → Unusual activity: counts by severity (each a filter), time
 * affected against the 60 days before, and each instance with its reasons
 * and where to check it.
 */
export function MemberUnusualActivityContent({ organisationId }: MemberUnusualActivityContentProps) {
  const { membershipId, fromKey, toKey } = useInsightsFilters();
  const reportQuery = useMemberUnusualActivity(organisationId, { membershipId, from: fromKey, to: toKey });
  const [selected, setSelected] = useState<UnusualSeverity[]>(ALL_SEVERITIES);
  const toggle = (severity: UnusualSeverity) =>
    setSelected((current) =>
      current.includes(severity) ? current.filter((item) => item !== severity) : [...current, severity],
    );

  return (
    <div className="flex flex-col gap-6">
      <InsightsMemberHeader organisationId={organisationId} title="Unusual activity" page="unusual-activity" />
      {reportQuery.isPending && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading…
        </p>
      )}
      {reportQuery.isError && <ErrorMessage message={reportQuery.error.message} />}
      {reportQuery.isSuccess && reportQuery.data.activityStatus === "disabled" && (
        <p className="rounded-brand-sm border border-input-border bg-white p-4 font-semibold text-secondary">
          Record activity disabled
        </p>
      )}
      {reportQuery.isSuccess && reportQuery.data.activityStatus !== "disabled" && (
        <UnusualActivityResults
          organisationId={organisationId}
          membershipId={membershipId}
          report={reportQuery.data}
          selected={selected}
          onToggle={toggle}
        />
      )}
    </div>
  );
}
