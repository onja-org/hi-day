"use client";

import { useState } from "react";
import { useInviteLinks } from "@/hooks/useInviteLinks";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { ErrorMessage } from "./ErrorMessage";
import { InviteLinkFormModal } from "./InviteLinkFormModal";
import { InviteLinkRow } from "./InviteLinkRow";
import { Spinner } from "./Spinner";

type InviteLinksTabProps = {
  organisationId: string;
};

export function InviteLinksTab({ organisationId }: InviteLinksTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const linksQuery = useInviteLinks(organisationId);
  const teamsQuery = useOrganisationTeams(organisationId);

  if (linksQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading invite links…
      </p>
    );
  }

  if (linksQuery.isError || !linksQuery.data) {
    return (
      <ErrorMessage
        message={linksQuery.error instanceof Error ? linksQuery.error.message : "Could not load invite links."}
      />
    );
  }

  const teamNames = new Map((teamsQuery.data ?? []).map((team) => [team.id, team.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-900/70">
          Share a link so people can ask to join. Each person confirms their email before they&apos;re added.
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 cursor-pointer rounded-md bg-primary px-5 h-11 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary/90"
        >
          Create link
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-primary-dark">
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">Role</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Teams</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Projects</th>
            <th className="hidden px-4 py-3 font-semibold lg:table-cell">Expiration date</th>
            <th className="hidden px-4 py-3 font-semibold lg:table-cell">Usage</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {linksQuery.data.map((link) => (
            <InviteLinkRow key={link.id} organisationId={organisationId} link={link} teamNames={teamNames} />
          ))}
          {linksQuery.data.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-900">
                No invite links yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {createOpen && <InviteLinkFormModal organisationId={organisationId} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
