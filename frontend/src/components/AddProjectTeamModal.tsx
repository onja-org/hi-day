"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAssignableProjectTeams } from "@/hooks/useAssignableProjectTeams";
import { PROJECT_QUERY_KEY, useProject } from "@/hooks/useProject";
import { addProjectTeam } from "@/lib/addProjectTeam";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type AddProjectTeamModalProps = {
  organisationId: string;
  projectId: string;
  onClose: () => void;
};

export function AddProjectTeamModal({
  organisationId,
  projectId,
  onClose,
}: AddProjectTeamModalProps) {
  const queryClient = useQueryClient();
  const projectQuery = useProject(organisationId, projectId);
  const teamsQuery = useAssignableProjectTeams(organisationId, projectId);
  const [teamId, setTeamId] = useState("");

  const mutation = useMutation({
    mutationFn: (id: string) =>
      addProjectTeam(organisationId, projectId, { teamId: id }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: PROJECT_QUERY_KEY(organisationId, projectId),
        });
        onClose();
      }
    },
  });

  const assignedTeamIds = projectQuery.data?.teams.map((team) => team.teamId) ?? [];
  const availableTeams = (teamsQuery.data ?? []).filter(
    (team) => !assignedTeamIds.includes(team.id),
  );
  const isLoading = projectQuery.isLoading || teamsQuery.isLoading;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamId) {
      return;
    }
    mutation.mutate(teamId);
  }

  const submitError = mutation.data && !mutation.data.ok ? mutation.data.message : null;

  return (
    <Modal title="Add team to project" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-5">
        {submitError && <ErrorMessage message={submitError} />}

        <p className="text-sm text-slate-900">
          Everyone on the team gains access to log time and be assigned tasks
          on this project.
        </p>

        <label className="flex flex-col gap-1.5">
          Team
          <select
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            required
            disabled={isLoading}
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select a team</option>
            {availableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

        {availableTeams.length === 0 && !isLoading && (
          <p className="text-sm text-slate-900">
            Every team is already assigned to this project.
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending || !teamId}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {mutation.isPending && <Spinner />}
          Add to project
        </button>
      </form>
    </Modal>
  );
}
