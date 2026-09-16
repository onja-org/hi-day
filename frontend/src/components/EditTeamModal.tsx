"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ORGANISATION_TEAMS_QUERY_KEY } from "@/hooks/useOrganisationTeams";
import { TEAM_DETAIL_QUERY_KEY } from "@/hooks/useTeamDetail";
import { updateTeam } from "@/lib/updateTeam";
import type { OrganisationTeam } from "@/types/team";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type EditTeamModalProps = {
  organisationId: string;
  team: OrganisationTeam;
  onClose: () => void;
};

export function EditTeamModal({ organisationId, team, onClose }: EditTeamModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(team.name);

  const mutation = useMutation({
    mutationFn: (newName: string) => updateTeam(organisationId, team.id, newName),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: ORGANISATION_TEAMS_QUERY_KEY(organisationId),
        });
        queryClient.invalidateQueries({
          queryKey: TEAM_DETAIL_QUERY_KEY(organisationId, team.id),
        });
        onClose();
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    mutation.mutate(trimmed);
  }

  const submitError = mutation.data && !mutation.data.ok ? mutation.data.message : null;

  return (
    <Modal title="Edit team" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
        {submitError && <ErrorMessage message={submitError} />}

        <label className="flex flex-col gap-1.5">
          Name
          <input
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {mutation.isPending && <Spinner />}
          Save
        </button>
      </form>
    </Modal>
  );
}
