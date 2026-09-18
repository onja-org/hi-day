"use client";

import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { ORGANISATION_TEAMS_QUERY_KEY } from "@/hooks/useOrganisationTeams";
import { addTeamMember } from "@/lib/addTeamMember";
import { createTeam } from "@/lib/createTeam";
import type { CreateTeamResult, OrganisationTeam } from "@/types/team";
import { Spinner } from "./Spinner";

type TeamFormProps = {
  organisationId: string;
  onSaved: (team: OrganisationTeam) => void;
};

export function TeamForm({ organisationId, onSaved }: TeamFormProps) {
  const queryClient = useQueryClient();
  const membersQuery = useActiveMembers(organisationId);

  const mutation = useMutation({
    mutationFn: async (input: {
      name: string;
      managerMembershipId: string;
    }): Promise<CreateTeamResult> => {
      const result = await createTeam(organisationId, input.name);
      if (!result.ok || !input.managerMembershipId) {
        return result;
      }

      const memberResult = await addTeamMember(
        organisationId,
        result.team.id,
        { membershipId: input.managerMembershipId, isManager: true },
      );
      if (!memberResult.ok) {
        return {
          ok: false,
          message: `Team created, but assigning the manager failed: ${memberResult.message}`,
        };
      }

      return result;
    },
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: ORGANISATION_TEAMS_QUERY_KEY(organisationId),
        });
        onSaved(result.team);
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return;
    }

    const managerMembershipId = String(formData.get("managerMembershipId") ?? "");

    mutation.mutate({ name, managerMembershipId });
  }

  const members = membersQuery.data ?? [];

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        Name
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Manager (optional)
        <select
          name="managerMembershipId"
          defaultValue=""
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">No manager</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name ?? member.email}
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
        Create team
      </button>
    </form>
  );
}
