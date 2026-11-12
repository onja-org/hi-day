"use client";

import { useEffect } from "react";
import { CaretRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useCanViewOthers } from "@/hooks/useCanViewOthers";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";

type InsightsMemberListProps = {
  organisationId: string;
};

/**
 * The "All members" page: everyone the viewer may see, each a way into
 * their Insights. Someone who can only see themselves has no list to pick
 * from, so they go straight to their own Timeline.
 */
export function InsightsMemberList({ organisationId }: InsightsMemberListProps) {
  const router = useRouter();
  const organisationQuery = useCurrentOrganisation();
  const canViewOthers = useCanViewOthers();
  const membersQuery = useActiveMembers(organisationId, { enabled: canViewOthers });
  const timelineHref = `/organisations/${organisationId}/insights/timeline`;

  useEffect(() => {
    if (organisationQuery.isSuccess && !canViewOthers) router.replace(timelineHref);
  }, [organisationQuery.isSuccess, canViewOthers, router, timelineHref]);

  if (organisationQuery.isPending || membersQuery.isPending) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }
  if (membersQuery.isError) {
    return <ErrorMessage message={membersQuery.error.message} />;
  }

  const members = [...membersQuery.data].sort((a, b) =>
    (a.name ?? a.email).localeCompare(b.name ?? b.email),
  );

  return (
    <ul className="divide-y divide-input-border rounded-brand-sm border border-input-border bg-white">
      {members.map((member) => (
        <li key={member.id}>
          <Link
            href={`${timelineHref}?member=${member.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-cream"
          >
            <span className="flex flex-col">
              <span className="font-semibold text-slate-900">{member.name ?? member.email}</span>
              {member.name && <span className="text-sm text-secondary">{member.email}</span>}
            </span>
            <CaretRightIcon size={16} aria-hidden="true" className="text-secondary" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
