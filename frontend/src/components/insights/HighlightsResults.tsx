import type { MemberHighlights } from "@/types/highlights";
import { BehaviourChangeCard } from "./BehaviourChangeCard";
import { HighlightsUnusualCard } from "./HighlightsUnusualCard";

type HighlightsResultsProps = {
  organisationId: string;
  /** Omitted when looking at your own. */
  membershipId?: string;
  fromKey: string;
  report: MemberHighlights;
};

/**
 * Unusual activity and changes in behaviour side by side at the same
 * height, each with its own friendly empty state. Without recorded
 * activity there's no unusual activity to check, but core work can still
 * have changed, so the behaviour card always shows.
 */
export function HighlightsResults({ organisationId, membershipId, fromKey, report }: HighlightsResultsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      <div className="flex flex-col md:col-span-3">
        <HighlightsUnusualCard organisationId={organisationId} membershipId={membershipId} report={report} />
      </div>
      <div className="flex flex-col md:col-span-2">
        <BehaviourChangeCard
          fromKey={fromKey}
          checkedThrough={report.checkedThrough}
          behaviourChanges={report.behaviourChanges}
          ownPage={membershipId === undefined}
        />
      </div>
    </div>
  );
}
