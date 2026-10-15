"use client";

import { useState } from "react";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { matchesSearch } from "@/lib/matchesSearch";
import { ErrorMessage } from "./ErrorMessage";
import { InvitationRow } from "./InvitationRow";
import { InviteMemberModal } from "./InviteMemberModal";
import { SearchInput } from "./SearchInput";
import { Spinner } from "./Spinner";

type InvitesTabProps = {
  organisationId: string;
};

export function InvitesTab({ organisationId }: InvitesTabProps) {
  const projectsEnabled = useProjectsEnabled();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const invitationsQuery = usePendingInvitations(organisationId);
  const teamsQuery = useOrganisationTeams(organisationId);

  if (invitationsQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading invites…
      </p>
    );
  }

  if (invitationsQuery.isError || !invitationsQuery.data) {
    return (
      <ErrorMessage
        message={
          invitationsQuery.error instanceof Error
            ? invitationsQuery.error.message
            : "Could not load invites."
        }
      />
    );
  }

  const teamNames = new Map((teamsQuery.data ?? []).map((team) => [team.id, team.name]));
  const invitations = invitationsQuery.data.filter((invitation) =>
    matchesSearch([invitation.email], search),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search invites" />
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="shrink-0 cursor-pointer rounded-brand-sm bg-primary px-5 h-11 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary/90 border-2 border-ink"
        >
          Invite member
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-primary-dark">
            <th className="px-4 py-3 font-semibold">Member</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">Role</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Teams</th>
            {projectsEnabled && (
              <th className="hidden px-4 py-3 font-semibold md:table-cell">Projects</th>
            )}
            <th className="hidden px-4 py-3 font-semibold lg:table-cell">Date sent</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              organisationId={organisationId}
              invitation={invitation}
              teamNames={teamNames}
            />
          ))}
          {invitations.length === 0 && (
            <tr>
              <td colSpan={projectsEnabled ? 7 : 6} className="px-4 py-8 text-center text-slate-900">
                {search.trim() ? "No invites match your search." : "No invites yet."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {inviteOpen && (
        <InviteMemberModal organisationId={organisationId} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}
