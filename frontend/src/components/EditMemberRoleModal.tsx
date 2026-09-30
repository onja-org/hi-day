"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { formatMembershipRole } from "@/lib/formatMembershipRole";
import { updateMembership } from "@/lib/updateMembership";
import type { ActiveMember, MembershipRole } from "@/types/membership";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type EditMemberRoleModalProps = {
  organisationId: string;
  member: ActiveMember;
  /** The roles this caller may grant — a manager can't grant admin. */
  availableRoles: MembershipRole[];
  onClose: () => void;
};

// Mirrors CONTEXT.md's MembershipRole entry.
const ROLE_DESCRIPTIONS: Record<MembershipRole, string> = {
  admin: "Sees and manages everyone in the organisation, including roles and settings.",
  manager: "Sees and manages the members of the teams they manage.",
  member: "Tracks their own time and sees only their own activity.",
  finance: "No permissions defined yet.",
};

export function EditMemberRoleModal({
  organisationId,
  member,
  availableRoles,
  onClose,
}: EditMemberRoleModalProps) {
  const invalidate = useInvalidateTeams(organisationId);
  const [role, setRole] = useState<MembershipRole>(member.role);

  const mutation = useMutation({
    mutationFn: () => updateMembership(organisationId, member.id, { role }),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onClose();
      }
    },
  });
  const failure = mutation.data && !mutation.data.ok ? mutation.data.message : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title={`Edit role · ${member.name ?? member.email}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Role</legend>
          {availableRoles.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-input-border p-3 has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
                className="mt-1 accent-primary"
              />
              <span className="flex flex-col">
                <span className="font-medium text-slate-900">{formatMembershipRole(option)}</span>
                <span className="text-sm text-slate-900/70">{ROLE_DESCRIPTIONS[option]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {failure && <ErrorMessage message={failure} />}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-input-border px-4 h-11 text-slate-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={role === member.role || mutation.isPending}
            className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending && <Spinner />}
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
