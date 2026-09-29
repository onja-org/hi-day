"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { PENDING_INVITATIONS_QUERY_KEY } from "@/hooks/usePendingInvitations";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { useProjects } from "@/hooks/useProjects";
import { formatMembershipRole } from "@/lib/formatMembershipRole";
import { inviteMembers } from "@/lib/inviteMembers";
import { parseInviteEmails } from "@/lib/parseInviteEmails";
import type { MembershipRole } from "@/types/membership";
import { CheckboxDropdownField } from "@/components/CheckboxDropdownField";
import { InviteEmailsField } from "@/components/InviteEmailsField";
import { InviteResultsList } from "@/components/InviteResultsList";
import { Spinner } from "@/components/Spinner";
import { SelectField } from "@/components/ui/form/SelectField";

type InviteMemberFormProps = {
  organisationId: string;
};

const ADMIN_INVITABLE_ROLES: MembershipRole[] = ["admin", "manager", "member"];
// Only an admin can invite someone as an admin — enforced server-side too.
const MANAGER_INVITABLE_ROLES: MembershipRole[] = ["manager", "member"];

export function InviteMemberForm({ organisationId }: InviteMemberFormProps) {
  const queryClient = useQueryClient();
  const teamsQuery = useOrganisationTeams(organisationId);
  const projectsQuery = useProjects(organisationId, { status: "active" });
  const organisationQuery = useCurrentOrganisation();
  const roles =
    organisationQuery.data?.role === "admin" ? ADMIN_INVITABLE_ROLES : MANAGER_INVITABLE_ROLES;
  const [projectIds, setProjectIds] = useState<Set<string>>(new Set());
  const [emailsText, setEmailsText] = useState("");
  const [teamIds, setTeamIds] = useState<Set<string>>(new Set());

  const mutation = useMutation({
    mutationFn: (variables: {
      emails: string[];
      role: MembershipRole;
      teamIds: string[];
      projectIds: string[];
    }) =>
      inviteMembers(
        organisationId,
        variables.emails.map((email) => ({
          email,
          role: variables.role,
          teamIds: variables.teamIds,
          projectIds: variables.projectIds,
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const emails = parseInviteEmails(emailsText);
    const role = String(formData.get("role") ?? "member") as MembershipRole;

    if (emails.length === 0) {
      return;
    }

    mutation.mutate({
      emails,
      role,
      teamIds: [...teamIds],
      projectIds: [...projectIds],
    });
  }

  const results = mutation.data?.ok ? mutation.data.results : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-6"
    >
      {results && <InviteResultsList results={results} />}

      <InviteEmailsField value={emailsText} onChange={setEmailsText} />

      <SelectField label="Role" name="role" defaultValue="member">
        {roles.map((role) => (
          <option key={role} value={role}>
            {formatMembershipRole(role)}
          </option>
        ))}
      </SelectField>

      <CheckboxDropdownField
        id="invite-teams"
        label="Teams (optional)"
        items={teamsQuery.data ?? []}
        selectedIds={teamIds}
        onChange={setTeamIds}
        noun={["team", "teams"]}
        isLoading={teamsQuery.isLoading}
      />

      <CheckboxDropdownField
        id="invite-projects"
        label="Projects (optional)"
        items={projectsQuery.data ?? []}
        selectedIds={projectIds}
        onChange={setProjectIds}
        noun={["project", "projects"]}
        isLoading={projectsQuery.isLoading}
      />

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
