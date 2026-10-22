"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretRightIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useTeamDashboardSummary } from "@/hooks/useTeamDashboardSummary";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { formatElapsed } from "@/lib/formatElapsed";
import { ErrorMessage } from "./ErrorMessage";
import { ReportsTableFooter } from "./reports/ReportsTableFooter";
import { Spinner } from "./Spinner";

type WhosOnlineListProps = {
  organisationId: string;
};

const PER_PAGE_OPTIONS = [5, 10, 25, 50];

export function WhosOnlineList({ organisationId }: WhosOnlineListProps) {
  const projectsEnabled = useProjectsEnabled();
  const summaryQuery = useTeamDashboardSummary(organisationId);
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
  const [requestedPage, setRequestedPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  if (summaryQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <ErrorMessage message="Could not load who's online." />;
  }

  const onlineMembers = summaryQuery.data.members.filter(
    (member) => member.isWorking,
  );
  const pageCount = showAll
    ? 1
    : Math.max(1, Math.ceil(onlineMembers.length / perPage));
  // Clamp, because the list is polled and can shrink while on a later page.
  const page = Math.min(requestedPage, pageCount);
  const members = showAll
    ? onlineMembers
    : onlineMembers.slice((page - 1) * perPage, page * perPage);

  if (members.length === 0) {
    return <p className="text-slate-900">Nobody is online right now.</p>;
  }

  return (
    <div className="flex flex-col rounded-lg border border-input-border">
      <div className="flex items-center gap-3 px-3 py-2 text-xs font-medium tracking-wide text-slate-900/60 uppercase">
        <span className="flex-1">Member</span>
        <span className="w-20 shrink-0 text-right whitespace-nowrap">Today</span>
        <span className="w-24 shrink-0 text-right whitespace-nowrap">
          This week
        </span>
        <span className="w-4" aria-hidden="true" />
      </div>
      <ul className="flex flex-col divide-y divide-input-border border-t border-input-border">
        {members.map((member) => (
          <li key={member.membershipId}>
            <Link
              href={`/organisations/${organisationId}/activities/apps?membershipId=${member.membershipId}`}
              className="flex items-center gap-3 p-3 transition-colors duration-150 hover:bg-cream"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <UserCircleIcon size={24} aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-slate-900">
                  {member.name ?? member.email}
                </span>
                {projectsEnabled && member.currentProjectName && (
                  <span className="text-xs text-slate-900/60">
                    {member.currentProjectName}
                  </span>
                )}
              </div>
              <div className="flex w-20 shrink-0 flex-col items-end gap-1">
                <span className="text-xs tabular-nums whitespace-nowrap text-slate-900/70">
                  {formatElapsed(member.workedTodaySeconds * 1000)}
                </span>
              </div>
              <div className="flex w-24 shrink-0 flex-col items-end gap-1">
                <span className="text-xs tabular-nums whitespace-nowrap text-slate-900/70">
                  {formatElapsed(member.workedThisWeekSeconds * 1000)}
                </span>
              </div>
              <CaretRightIcon
                size={16}
                className="w-4 shrink-0 text-slate-900/40"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
      <ReportsTableFooter
        totalRows={onlineMembers.length}
        perPage={perPage}
        perPageOptions={PER_PAGE_OPTIONS}
        onPerPageChange={(value) => {
          setPerPage(value);
          setRequestedPage(1);
          setShowAll(false);
        }}
        page={page}
        pageCount={pageCount}
        onPageChange={(value) => {
          setRequestedPage(value);
          setShowAll(false);
        }}
        onShowAll={() => setShowAll(true)}
        allSelected={showAll}
      />
    </div>
  );
}
