"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAssignableProjectMembers } from "@/hooks/useAssignableProjectMembers";
import { PROJECT_QUERY_KEY } from "@/hooks/useProject";
import { addProjectMember } from "@/lib/addProjectMember";
import type { AddProjectMemberInput, ProjectMembershipRole } from "@/types/project";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type AddProjectMemberModalProps = {
  organisationId: string;
  projectId: string;
  assignedMembershipIds: string[];
  onClose: () => void;
};

export function AddProjectMemberModal({
  organisationId,
  projectId,
  assignedMembershipIds,
  onClose,
}: AddProjectMemberModalProps) {
  const queryClient = useQueryClient();
  const membersQuery = useAssignableProjectMembers(organisationId, projectId);
  const [membershipId, setMembershipId] = useState("");

  const mutation = useMutation({
    mutationFn: (input: AddProjectMemberInput) =>
      addProjectMember(organisationId, projectId, input),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: PROJECT_QUERY_KEY(organisationId, projectId),
        });
        onClose();
      }
    },
  });

  const availableMembers = (membersQuery.data ?? []).filter(
    (member) => !assignedMembershipIds.includes(member.id),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membershipId) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    const rate = String(formData.get("rate") ?? "").trim();
    const role = String(formData.get("role") ?? "member") as ProjectMembershipRole;
    mutation.mutate({ membershipId, rate: rate || undefined, role });
  }

  const submitError = mutation.data && !mutation.data.ok ? mutation.data.message : null;

  return (
    <Modal title="Add member to project" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-5">
        {submitError && <ErrorMessage message={submitError} />}

        <label className="flex flex-col gap-1.5">
          Member
          <select
            value={membershipId}
            onChange={(event) => setMembershipId(event.target.value)}
            required
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select a member</option>
            {availableMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name ?? member.email}
              </option>
            ))}
          </select>
        </label>

        {availableMembers.length === 0 && !membersQuery.isLoading && (
          <p className="text-sm text-slate-900">
            Every active member is already assigned to this project.
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          Role
          <select
            name="role"
            defaultValue="member"
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="member">Member — can be assigned and logged against</option>
            <option value="admin">Admin — can manage this project</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          Rate override (optional)
          <input
            name="rate"
            type="number"
            min="0"
            step="0.01"
            placeholder="Uses the project's default rate if left blank"
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <button
          type="submit"
          disabled={mutation.isPending || !membershipId}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {mutation.isPending && <Spinner />}
          Add to project
        </button>
      </form>
    </Modal>
  );
}
