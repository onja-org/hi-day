"use client";

import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { useMemberHighlights } from "@/hooks/useMemberHighlights";
import { HighlightsResults } from "./HighlightsResults";
import { InsightsMemberHeader } from "./InsightsMemberHeader";

type MemberHighlightsContentProps = {
  organisationId: string;
};

/**
 * Insights → Highlights: only what stood out over the range — the unusual
 * activity summary and big changes in behaviour — so a manager doesn't
 * have to read every report.
 */
export function MemberHighlightsContent({ organisationId }: MemberHighlightsContentProps) {
  const { membershipId, fromKey, toKey } = useInsightsFilters();
  const reportQuery = useMemberHighlights(organisationId, { membershipId, from: fromKey, to: toKey });

  return (
    <div className="flex flex-col gap-6">
      <InsightsMemberHeader organisationId={organisationId} title="Highlights" page="highlights" />
      {reportQuery.isPending && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading…
        </p>
      )}
      {reportQuery.isError && <ErrorMessage message={reportQuery.error.message} />}
      {reportQuery.isSuccess && (
        <HighlightsResults
          organisationId={organisationId}
          membershipId={membershipId}
          fromKey={fromKey}
          report={reportQuery.data}
        />
      )}
    </div>
  );
}
