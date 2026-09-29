"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import clsx from "clsx";
import { useMutation } from "@tanstack/react-query";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { updateTeam } from "@/lib/updateTeam";
import { TextField } from "@/components/ui/form/TextField";

type TeamRenameFormProps = {
  organisationId: string;
  teamId: string;
  currentName: string;
  compact?: boolean;
};

export function TeamRenameForm({
  organisationId,
  teamId,
  currentName,
  compact = false,
}: TeamRenameFormProps) {
  const invalidate = useInvalidateTeams(organisationId);
  const [name, setName] = useState<string | null>(null);

  const renameMutation = useMutation({
    mutationFn: (newName: string) =>
      updateTeam(organisationId, teamId, newName),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
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

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <TextField
          label="Team name"
          type="text"
          value={name ?? currentName}
          onChange={(event) => setName(event.target.value)}
          inputClassName={clsx(
            compact
              ? "text-slate-900"
              : "text-2xl font-semibold text-primary-dark",
          )}
        />
        <button
          type="submit"
          disabled={renameMutation.isPending}
          className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          Save
        </button>
      </form>
    </div>
  );
}
