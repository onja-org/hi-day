"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PENDING_INVITATIONS_QUERY_KEY } from "@/hooks/usePendingInvitations";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { inviteMembers } from "@/lib/inviteMembers";
import { parseInviteEmails } from "@/lib/parseInviteEmails";
import type { MembershipRole } from "@/types/membership";
import { ErrorMessage } from "./ErrorMessage";
import { InviteEmailsField } from "./InviteEmailsField";
import { InviteResultsList } from "./InviteResultsList";
import { Spinner } from "./Spinner";

type InviteMemberFormProps = {
  organisationId: string;
};

const ROLES: MembershipRole[] = ["admin", "manager", "member"];

export function InviteMemberForm({ organisationId }: InviteMemberFormProps) {
  const queryClient = useQueryClient();
  const teamsQuery = useOrganisationTeams(organisationId);
  const [emailsText, setEmailsText] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (variables: {
      emails: string[];
      role: MembershipRole;
      teamId?: string;
    }) =>
      inviteMembers(
        organisationId,
        variables.emails.map((email) => ({
          email,
          role: variables.role,
          teamId: variables.teamId,
        })),
      ),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: PENDING_INVITATIONS_QUERY_KEY(organisationId),
        });
      }
    },
  });

  const teams = teamsQuery.data ?? [];
  const effectiveTeamId = selectedTeamId ?? teams[0]?.id ?? "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const emails = parseInviteEmails(emailsText);
    const role = String(formData.get("role") ?? "member") as MembershipRole;

    if (emails.length === 0) {
      return;
    }

    mutation.mutate({ emails, role, teamId: effectiveTeamId || undefined });
  }

  const results = mutation.data?.ok ? mutation.data.results : null;
  const submitError = mutation.data && !mutation.data.ok ? mutation.data.message : null;

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-6">
      {submitError && <ErrorMessage message={submitError} />}
      {results && <InviteResultsList results={results} />}

      <InviteEmailsField value={emailsText} onChange={setEmailsText} />

      <label className="flex flex-col gap-1.5">
        Role
        <select
          name="role"
          defaultValue="member"
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        Team (optional)
        <select
          name="teamId"
          value={effectiveTeamId}
          onChange={(event) => setSelectedTeamId(event.target.value)}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">No team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
      >
        {mutation.isPending && <Spinner />}
        {mutation.isPending ? "Sending…" : "Send invitations"}
      </button>
    </form>
  );
}
