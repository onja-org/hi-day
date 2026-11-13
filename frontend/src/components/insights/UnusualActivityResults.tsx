import { summariseUnusualActivity } from "@/lib/summariseUnusualActivity";
import type { MemberUnusualActivity, UnusualSeverity } from "@/types/unusualActivity";
import { UnusualActivityEmptyState } from "./UnusualActivityEmptyState";
import { UnusualActivityNormalNote } from "./UnusualActivityNormalNote";
import { UnusualActivitySummary } from "./UnusualActivitySummary";
import { UnusualInstanceList } from "./UnusualInstanceList";

type UnusualActivityResultsProps = {
  organisationId: string;
  /** Omitted when looking at your own. */
  membershipId?: string;
  report: MemberUnusualActivity;
  selected: UnusualSeverity[];
  onToggle: (severity: UnusualSeverity) => void;
};

/**
 * What was found: the summary and list, or the friendly empty state when
 * nothing stood out. A member who may not see their own activity gets the
 * empty state too, so the page never hints at what's collected. Either
 * way, patterns skipped as the member's normal are named.
 */
export function UnusualActivityResults({
  organisationId,
  membershipId,
  report,
  selected,
  onToggle,
}: UnusualActivityResultsProps) {
  const normalNote = (
    <UnusualActivityNormalNote rules={report.normalForMember} ownPage={membershipId === undefined} />
  );
  if (report.instances.length === 0) {
    return (
      <>
        <UnusualActivityEmptyState notCheckedYet={report.checkedThrough === null} />
        {normalNote}
      </>
    );
  }

  const summary = summariseUnusualActivity(report, selected);
  return (
    <>
      <UnusualActivitySummary summary={summary} selected={selected} onToggle={onToggle} />
      {summary.instances.length > 0 ? (
        <UnusualInstanceList
          organisationId={organisationId}
          membershipId={membershipId}
          instances={summary.instances}
          timezone={report.timezone}
        />
      ) : (
        <p className="text-sm text-secondary">No instances at the selected severity.</p>
      )}
      {normalNote}
    </>
  );
}
