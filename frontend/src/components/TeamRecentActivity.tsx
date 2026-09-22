"use client";

import Image from "next/image";
import { ImagesSquareIcon } from "@phosphor-icons/react";
import { useTeamDashboardSummary } from "@/hooks/useTeamDashboardSummary";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type TeamRecentActivityProps = {
  organisationId: string;
};

export function TeamRecentActivity({ organisationId }: TeamRecentActivityProps) {
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
    return <ErrorMessage message="Could not load the team's recent activity." />;
  }

  const recentActivity = summaryQuery.data.recentActivity;

  if (recentActivity.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-input-border p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-sidebar text-slate-900/60">
          <ImagesSquareIcon size={24} aria-hidden="true" />
        </span>
        <p className="font-medium text-slate-900">No one has worked yet today</p>
        <p className="max-w-sm text-sm text-slate-900/60">
          Screenshots from teammates actively tracking time today will show up
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {recentActivity.map((member) => (
        <div
          key={member.membershipId}
          className="flex flex-col gap-2 rounded-lg border border-input-border p-4"
        >
          <p className="text-sm font-medium text-slate-900">
            {member.name ?? "Unnamed member"}
          </p>
          {member.screenshots.length === 0 ? (
            <p className="text-sm text-slate-900/60">
              No screenshots captured yet today.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {member.screenshots.map((screenshot, index) => (
                <div
                  key={screenshot.id}
                  className="relative aspect-video overflow-hidden rounded-lg bg-cream"
                >
                  {/* unoptimized: each url is a presigned, single-use Wasabi link — not worth proxying through Next's image optimizer. */}
                  <Image
                    src={screenshot.url}
                    alt={`Screenshot of ${member.name ?? "this member"} captured at ${new Date(screenshot.capturedAt).toLocaleTimeString()}`}
                    fill
                    unoptimized
                    priority={index === 0}
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
