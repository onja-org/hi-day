"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { updateTeam } from "@/lib/updateTeam";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type EditTeamModalProps = {
  organisationId: string;
  teamId: string;
  currentName: string;
  onClose: () => void;
};

/** Renames a team — admin-only, like creating and deleting one. */
export function EditTeamModal({ organisationId, teamId, currentName, onClose }: EditTeamModalProps) {
  const invalidate = useInvalidateTeams(organisationId);
  const [name, setName] = useState(currentName);

  const mutation = useMutation({
    mutationFn: () => updateTeam(organisationId, teamId, name.trim()),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onClose();
      }
    },
  });
  const failure = mutation.data && !mutation.data.ok ? mutation.data.message : null;
  const trimmed = name.trim();
  const canSave = trimmed !== "" && trimmed !== currentName;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSave) mutation.mutate();
  }

  return (
    <Modal title="Edit team" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-slate-900">
          Team name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="rounded-md border border-input-border px-3 py-2 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
          />
        </label>

        {failure && <ErrorMessage message={failure} />}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-input-border px-4 py-2 text-slate-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave || mutation.isPending}
            className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending && <Spinner />}
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
