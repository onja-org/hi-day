"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TEAM_DETAIL_QUERY_KEY } from "@/hooks/useTeamDetail";
import { updateTeam } from "@/lib/updateTeam";
import { ErrorMessage } from "./ErrorMessage";

type TeamRenameFormProps = {
  organisationId: string;
  teamId: string;
  currentName: string;
};

export function TeamRenameForm({
  organisationId,
  teamId,
  currentName,
}: TeamRenameFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null);

  const renameMutation = useMutation({
    mutationFn: (newName: string) => updateTeam(organisationId, teamId, newName),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: TEAM_DETAIL_QUERY_KEY(organisationId, teamId),
        });
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = (name ?? "").trim();
    if (!trimmed || trimmed === currentName) {
      return;
    }
    renameMutation.mutate(trimmed);
  }

  const renameError =
    renameMutation.data && !renameMutation.data.ok
      ? renameMutation.data.message
      : null;

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <label className="sr-only" htmlFor="team-name">
          Team name
        </label>
        <input
          id="team-name"
          type="text"
          value={name ?? currentName}
          onChange={(event) => setName(event.target.value)}
          className="rounded-md border border-input-border px-3 py-2 text-2xl font-semibold text-primary-dark"
        />
        <button
          type="submit"
          disabled={renameMutation.isPending}
          className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          Save
        </button>
      </form>
      {renameError && <ErrorMessage message={renameError} />}
    </div>
  );
}
