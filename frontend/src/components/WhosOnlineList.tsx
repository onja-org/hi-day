"use client";

import clsx from "clsx";
import Link from "next/link";
import { CaretRightIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useTeamDashboardSummary } from "@/hooks/useTeamDashboardSummary";
import { formatElapsed } from "@/lib/formatElapsed";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type WhosOnlineListProps = {
  organisationId: string;
};

export function WhosOnlineList({ organisationId }: WhosOnlineListProps) {
  const summaryQuery = useTeamDashboardSummary(organisationId);

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

  const members = summaryQuery.data.members;

  if (members.length === 0) {
    return <p className="text-slate-900">No team members to show yet.</p>;
  }

  return (
    <div className="flex flex-col rounded-lg border border-input-border">
      <div className="flex items-center gap-3 px-3 py-2 text-xs font-medium tracking-wide text-slate-900/60 uppercase">
        <span className="flex-1">Member</span>
        <span className="w-14 text-right">Today</span>
        <span className="w-16 text-right">This week</span>
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
                <span className="flex items-center gap-1.5 text-xs text-slate-900/60">
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      member.isWorking ? "bg-primary" : "bg-secondary/40",
                    )}
                  />
                  {member.isWorking
                    ? (member.currentProjectName ?? "Working")
                    : "Not working"}
                </span>
              </div>
              <div className="flex w-14 flex-col items-end gap-1">
                <span className="text-xs tabular-nums text-slate-900/70">
                  {formatElapsed(member.workedTodaySeconds * 1000)}
                </span>
              </div>
              <div className="flex w-16 flex-col items-end gap-1">
                <span className="text-xs tabular-nums text-slate-900/70">
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
    </div>
  );
}
