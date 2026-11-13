"use client";

import { ArrowRightIcon, SmileyIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatHoursMinutes } from "@/lib/formatHoursMinutes";
import { insightsHref } from "@/lib/insightsHref";
import type { MemberHighlights } from "@/types/highlights";
import type { UnusualSeverity } from "@/types/unusualActivity";
import { HighlightsTopInstances } from "./HighlightsTopInstances";
import { SEVERITY_LABELS } from "./SeverityBadge";

type HighlightsUnusualCardProps = {
  organisationId: string;
  /** Omitted when looking at your own. */
  membershipId?: string;
  report: MemberHighlights;
};

const SEVERITIES: UnusualSeverity[] = ["highly_unusual", "unusual", "slightly_unusual"];

/**
 * The Unusual activity page in brief: time affected beside the 60 days
 * before, instances per severity, then the most serious ones — or the
 * friendly empty state, filling the rest of the card.
 */
export function HighlightsUnusualCard({ organisationId, membershipId, report }: HighlightsUnusualCardProps) {
  const searchParams = useSearchParams();
  const { counts, affectedSeconds, previousAffectedSeconds, topInstances } = report.unusualActivity;
  const total = counts.highly_unusual + counts.unusual + counts.slightly_unusual;
  const href = insightsHref(
    `/organisations/${organisationId}/insights`,
    { kind: "page", page: "unusual-activity", member: membershipId ?? null },
    searchParams,
  );

  return (
    <section className="flex grow flex-col gap-4 rounded-brand-sm border border-input-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">Unusual activity</h2>
        {total > 0 && (
          <Link
            href={href}
            className="flex items-center gap-1 text-sm text-primary underline-offset-2 hover:text-primary-dark hover:underline"
          >
            See all {total}
            <ArrowRightIcon size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      {report.activityStatus === "disabled" ? (
        <p className="font-semibold text-secondary">Record activity disabled</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-secondary">Time affected</dt>
              <dd className="font-data text-2xl text-slate-900">{formatHoursMinutes(affectedSeconds)}</dd>
            </div>
            <div>
              <dt className="text-sm text-secondary">Previous 60 days</dt>
              <dd className="font-data text-2xl text-slate-900">{formatHoursMinutes(previousAffectedSeconds)}</dd>
            </div>
          </dl>
          <dl className="grid grid-cols-3 gap-2 border-t border-input-border pt-4">
            {SEVERITIES.map((severity) => (
              <div
                key={severity}
                className={clsx(
                  "flex flex-col gap-1 rounded-brand-sm p-3",
                  severity === "highly_unusual" && "bg-error/10",
                  severity === "unusual" && "bg-sun-tint",
                  severity === "slightly_unusual" && "bg-sidebar",
                )}
              >
                <dt
                  className={clsx(
                    "text-sm font-semibold",
                    severity === "highly_unusual" && "text-error",
                    severity === "unusual" && "text-slate-900",
                    severity === "slightly_unusual" && "text-secondary",
                  )}
                >
                  {SEVERITY_LABELS[severity]}
                </dt>
                <dd className="flex items-baseline gap-1">
                  <span className="font-data text-xl text-slate-900">{counts[severity]}</span>
                  <span className="text-sm text-secondary">{counts[severity] === 1 ? "instance" : "instances"}</span>
                </dd>
              </div>
            ))}
          </dl>
          {total === 0 && (
            <p className="flex grow flex-col items-center justify-center gap-2 rounded-brand-sm bg-cream p-6 text-center text-sm text-slate-900">
              <SmileyIcon size={32} aria-hidden="true" className="shrink-0 text-primary-dark" />
              {report.checkedThrough === null ? (
                <span>Nothing to check yet - days are checked once they&apos;re over.</span>
              ) : (
                <>
                  <strong className="text-base font-semibold">That&apos;s good news!</strong>
                  <span>No unusual activity was recorded in the selected period.</span>
                </>
              )}
            </p>
          )}
          {total > 0 && <HighlightsTopInstances instances={topInstances} timezone={report.timezone} />}
        </>
      )}
    </section>
  );
}
