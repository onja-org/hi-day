"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { ORGANISATION_TEAMS_QUERY_KEY } from "@/hooks/useOrganisationTeams";
import { addTeamMembers } from "@/lib/addTeamMembers";
import { createTeam } from "@/lib/createTeam";
import { TEAM_ROLE_OPTIONS } from "@/lib/teamRoleOptions";
import type { CreateTeamResult, OrganisationTeam } from "@/types/team";
import { ErrorMessage } from "@/components/ErrorMessage";
import { TextField } from "@/components/ui/form/TextField";
import { MemberSearchChecklist } from "@/components/MemberSearchChecklist";
import { Spinner } from "@/components/Spinner";

type TeamFormProps = {
  organisationId: string;
  onSaved: (team: OrganisationTeam) => void;
};

export function TeamForm({ organisationId, onSaved }: TeamFormProps) {
  const queryClient = useQueryClient();
  const membersQuery = useActiveMembers(organisationId);
  const [selected, setSelected] = useState<Map<string, "member" | "manager">>(
    new Map(),
  );

  const mutation = useMutation({
    mutationFn: async (name: string): Promise<CreateTeamResult> => {
      const result = await createTeam(organisationId, name);
      if (!result.ok) {
        return result;
      }

      queryClient.invalidateQueries({
        queryKey: ORGANISATION_TEAMS_QUERY_KEY(organisationId),
      });

      if (selected.size === 0) {
        return result;
      }

      const memberResult = await addTeamMembers(
        organisationId,
        result.team.id,
        [...selected.entries()].map(([membershipId, role]) => ({
          membershipId,
          isManager: role === "manager",
        })),
      );
      if (memberResult.failed.length > 0) {
        return {
          ok: false,
          message: `Team created, but ${memberResult.failed.length} member${
            memberResult.failed.length === 1 ? "" : "s"
          } couldn't be added: ${memberResult.failed
            .map((failure) => failure.message)
            .join(", ")}`,
        };
      }

      return result;
    },
    onSuccess: (result) => {
      if (result.ok) {
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

    mutation.mutate(name);
  }

  const members = membersQuery.data ?? [];

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-5"
    >
      <TextField
        label="Name"
        name="name"
        type="text"
        required
        maxLength={120}
      />

      <div className="flex flex-col gap-1.5">
        <span>Add members (optional)</span>
        <MemberSearchChecklist
          candidates={members}
          selected={selected}
          isLoading={membersQuery.isLoading}
          emptyMessage="No active members to add yet."
          roleOptions={TEAM_ROLE_OPTIONS}
          onToggle={(id, checked) =>
            setSelected((current) => {
              const next = new Map(current);
              if (checked) {
                next.set(id, next.get(id) ?? "member");
              } else {
                next.delete(id);
              }
              return next;
            })
          }
          onRoleChange={(id, role) =>
            setSelected((current) => new Map(current).set(id, role))
          }
        />
      </div>

      {mutation.data && !mutation.data.ok && (
        <ErrorMessage message={mutation.data.message} />
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
      >
        {mutation.isPending && <Spinner />}
        Create team
      </button>
    </form>
  );
}
