"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/DateRangePicker";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useCanViewOthers } from "@/hooks/useCanViewOthers";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { insightsHref } from "@/lib/insightsHref";
import { DEFAULT_INSIGHTS_PRESET } from "@/lib/parseInsightsRange";
import type { InsightsPage } from "@/types/insights";

type InsightsMemberHeaderProps = {
  organisationId: string;
  /** The Insights page's own name, e.g. "Timeline". */
  title: string;
  /** Which page this is, so "All members" leads back to it for the next pick. */
  page: InsightsPage;
};

/**
 * The top of every per-member Insights page: the way back to the member
 * list (for those who can see anyone else), whose insights these are, and
 * the date range. Shared so each Insights page only renders its own body.
 */
export function InsightsMemberHeader({ organisationId, title, page }: InsightsMemberHeaderProps) {
  const searchParams = useSearchParams();
  const canViewOthers = useCanViewOthers();
  const { membershipId, range, preset, zone, setRange } = useInsightsFilters();
  const membersQuery = useActiveMembers(organisationId, {
    enabled: canViewOthers && membershipId !== undefined,
  });
  const member = membersQuery.data?.find((candidate) => candidate.id === membershipId);
  const memberLabel =
    membershipId === undefined ? "You" : (member?.name ?? member?.email ?? "Member");

  return (
    <header className="flex flex-col gap-4">
      {canViewOthers && (
        <Link
          href={insightsHref(`/organisations/${organisationId}/insights`, { kind: "list", page }, searchParams)}
          className="flex w-fit cursor-pointer items-center gap-2 text-sm text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-dark hover:underline"
        >
          <ArrowLeftIcon size={16} aria-hidden="true" />
          All members
        </Link>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary-dark">{title}</h1>
          <p className="text-slate-900">{memberLabel}</p>
        </div>
        <DateRangePicker
          id="insights-date-range"
          label="Date range"
          value={range}
          preset={preset}
          defaultPreset={DEFAULT_INSIGHTS_PRESET}
          zone={zone}
          onChange={setRange}
          align="end"
        />
      </div>
    </header>
  );
}
