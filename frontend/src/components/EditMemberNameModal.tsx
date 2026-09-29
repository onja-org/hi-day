"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { updateMembership } from "@/lib/updateMembership";
import type { ActiveMember } from "@/types/membership";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type EditMemberNameModalProps = {
  organisationId: string;
  member: ActiveMember;
  onClose: () => void;
};

export function EditMemberNameModal({ organisationId, member, onClose }: EditMemberNameModalProps) {
  const invalidate = useInvalidateTeams(organisationId);
  const [firstPart, ...rest] = (member.name ?? "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(firstPart ?? "");
  const [lastName, setLastName] = useState(rest.join(" "));

  const mutation = useMutation({
    mutationFn: () =>
      updateMembership(organisationId, member.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      }),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onClose();
      }
    },
  });
  const failure = mutation.data && !mutation.data.ok ? mutation.data.message : null;
  const canSave = firstName.trim() !== "" && lastName.trim() !== "";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSave) mutation.mutate();
  }

  return (
    <Modal title="Edit member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-slate-900/70">{member.email}</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-slate-900">
            First name
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              maxLength={100}
              required
              className="rounded-md border border-input-border px-3 py-2 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-slate-900">
            Last name
            <input
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              maxLength={100}
              required
              className="rounded-md border border-input-border px-3 py-2 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            />
          </label>
        </div>
        <p className="text-xs text-slate-900/70">
          This changes their name everywhere they use this account, including other organisations.
        </p>

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
