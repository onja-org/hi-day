"use client";

import Link from "next/link";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { formatElapsed } from "@/lib/formatElapsed";
import { settingsHref } from "@/lib/settingsNavigation";
import { workTimeShares } from "@/lib/workTimeShares";
import type { WorkTimeClassification } from "@/types/workClassification";
import { PerformanceCard } from "./PerformanceCard";
import { WorkTimeSplitBar } from "./WorkTimeSplitBar";

type WorkTimeClassificationCardProps = {
  organisationId: string;
  classification: WorkTimeClassification;
};

const NOTICES: Record<Exclude<WorkTimeClassification["status"], "available">, string> = {
  not_available: "Not available",
  no_data: "Not enough data",
};

/**
 * Core vs non-core work: the member's tracked app time split by the
 * organisation's labels. "Not available" when app & URL tracking is off for
 * them — never 0%, which would read as no core work.
 */
export function WorkTimeClassificationCard({ organisationId, classification }: WorkTimeClassificationCardProps) {
  const isAdmin = useCurrentOrganisation().data?.role === "admin";
  const title = "Work time classification";

  if (classification.status !== "available") {
    return <PerformanceCard title={title} notice={NOTICES[classification.status]} />;
  }

  const shares = workTimeShares(classification);
  const rows = [
    { label: "Core", share: shares.core, seconds: classification.coreSeconds },
    { label: "Non-core", share: shares.nonCore, seconds: classification.nonCoreSeconds },
    { label: "Unclassified", share: shares.unclassified, seconds: classification.unclassifiedSeconds },
  ];

  return (
    <PerformanceCard title={title}>
      <p className="font-data text-2xl text-primary-dark">{shares.core}% core</p>
      <WorkTimeSplitBar shares={shares} />
      <dl className="mt-2 flex flex-col gap-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-secondary">{row.label}</dt>
            <dd className="font-data text-slate-900">
              {row.share}% · {formatElapsed(row.seconds * 1000)}
            </dd>
          </div>
        ))}
      </dl>
      {isAdmin && classification.unclassifiedSeconds > 0 && (
        <Link
          href={settingsHref(organisationId, "tracking", "work-time-classification")}
          className="mt-2 w-fit text-sm text-primary underline-offset-2 hover:underline"
        >
          Label apps and websites
        </Link>
      )}
    </PerformanceCard>
  );
}
