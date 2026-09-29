"use client";

import { useState } from "react";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { matchesSearch } from "@/lib/matchesSearch";
import { ErrorMessage } from "./ErrorMessage";
import { MemberRow } from "./MemberRow";
import { MembersToolbar } from "./MembersToolbar";
import { Spinner } from "./Spinner";

type MembersTabProps = {
  organisationId: string;
};

export function MembersTab({ organisationId }: MembersTabProps) {
  const [search, setSearch] = useState("");
  const membersQuery = useActiveMembers(organisationId);
  const organisationQuery = useCurrentOrganisation();
  const teamsQuery = useOrganisationTeams(organisationId);

  if (membersQuery.isLoading || organisationQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading members…
      </p>
    );
  }

  if (membersQuery.isError || !membersQuery.data) {
    return (
      <ErrorMessage
        message={
          membersQuery.error instanceof Error
            ? membersQuery.error.message
            : "Could not load members."
        }
      />
    );
  }

  if (organisationQuery.isError || !organisationQuery.data) {
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not verify access."
        }
      />
    );
  }

  const teamNames = new Map((teamsQuery.data ?? []).map((team) => [team.id, team.name]));
  const members = membersQuery.data.filter((member) =>
    matchesSearch([member.name, member.email], search),
  );

  return (
    <div className="flex flex-col gap-6">
      <MembersToolbar
        organisationId={organisationId}
        members={members}
        teamNames={teamNames}
        callerUserId={organisationQuery.data.userId}
        search={search}
        onSearchChange={setSearch}
      />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-primary-dark">
            <th className="px-4 py-3 font-semibold">Member</th>
            <th className="hidden px-4 py-3 font-semibold lg:table-cell">Status</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">Role</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Projects</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Teams</th>
            <th className="hidden px-4 py-3 font-semibold lg:table-cell">Date added</th>
            <th className="px-4 py-3 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <MemberRow
              key={member.id}
              organisationId={organisationId}
              member={member}
              teamNames={teamNames}
              callerRole={organisationQuery.data.role}
              callerUserId={organisationQuery.data.userId}
            />
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-900">
                {search.trim() ? "No members match your search." : "No active members yet."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
