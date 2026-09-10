"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { ErrorMessage } from "./ErrorMessage";
import { MemberTimeEntriesList } from "./MemberTimeEntriesList";
import { RequireRole } from "./RequireRole";
import { Spinner } from "./Spinner";
import { UrlSessionList } from "./UrlSessionList";

type MemberDetailPageContentProps = {
  organisationId: string;
  memberId: string;
};

function BackToMembersLink({ organisationId }: { organisationId: string }) {
  return (
    <Link
      href={`/organisations/${organisationId}/members`}
      className="flex w-fit cursor-pointer items-center gap-2 text-sm text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-dark hover:underline"
    >
      <ArrowLeftIcon size={16} aria-hidden="true" />
      Back to members
    </Link>
  );
}

export function MemberDetailPageContent({
  organisationId,
  memberId,
}: MemberDetailPageContentProps) {
  return (
    <RequireRole role={["admin", "manager"]}>
      <MemberDetail organisationId={organisationId} memberId={memberId} />
    </RequireRole>
  );
}

function MemberDetail({
  organisationId,
  memberId,
}: MemberDetailPageContentProps) {
  const membersQuery = useActiveMembers(organisationId);

  if (membersQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <BackToMembersLink organisationId={organisationId} />
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading member…
        </p>
      </div>
    );
  }

  if (membersQuery.isError || !membersQuery.data) {
    return (
      <div className="flex flex-col gap-6">
        <BackToMembersLink organisationId={organisationId} />
        <ErrorMessage
          message={
            membersQuery.error instanceof Error
              ? membersQuery.error.message
              : "Could not load this member."
          }
        />
      </div>
    );
  }

  const member = membersQuery.data.find((candidate) => candidate.id === memberId);

  if (!member) {
    return (
      <div className="flex flex-col gap-6">
        <BackToMembersLink organisationId={organisationId} />
        <ErrorMessage message="This member could not be found." />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up flex flex-col gap-8">
      <BackToMembersLink organisationId={organisationId} />

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
          {(member.name ?? member.email).charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-primary-dark">
              {member.name ?? member.email}
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
              {member.role}
            </span>
          </div>
          <p className="text-slate-900/70">{member.email}</p>
          <p className="text-sm text-slate-900/70">
            Joined {new Date(member.joinedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-primary-dark">Timesheet</h2>
          <MemberTimeEntriesList
            organisationId={organisationId}
            membershipId={member.id}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-primary-dark">Activity</h2>
          <UrlSessionList
            organisationId={organisationId}
            membershipId={member.id}
            showDelete
          />
        </section>
      </div>
    </div>
  );
}
