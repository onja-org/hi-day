"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAssignableProjectMembers } from "@/hooks/useAssignableProjectMembers";
import { useInvalidateProject } from "@/hooks/useInvalidateProject";
import { useProject } from "@/hooks/useProject";
import { addProjectMembers } from "@/lib/addProjectMembers";
import { PROJECT_MEMBERSHIP_ROLE_OPTIONS } from "@/lib/projectMembershipRoleOptions";
import type { ProjectMembershipRole } from "@/types/project";
import { ErrorMessage } from "./ErrorMessage";
import { MemberSearchChecklist } from "./MemberSearchChecklist";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type AddProjectMemberModalProps = {
  organisationId: string;
  projectId: string;
  onClose: () => void;
};

export function AddProjectMemberModal({
  organisationId,
  projectId,
  onClose,
}: AddProjectMemberModalProps) {
  const invalidate = useInvalidateProject(organisationId, projectId);
  const projectQuery = useProject(organisationId, projectId);
  const membersQuery = useAssignableProjectMembers(organisationId, projectId);
  // membershipId -> role, for every currently-checked candidate. Presence in
  // the map is "checked"; the value is that row's own role choice, so one
  // batch can add some people as members and others as managers together.
  const [selected, setSelected] = useState<Map<string, ProjectMembershipRole>>(new Map());
  const [failures, setFailures] = useState<{ membershipId: string; message: string }[]>([]);

  const mutation = useMutation({
    mutationFn: () =>
      addProjectMembers(
        organisationId,
        projectId,
        [...selected.entries()].map(([membershipId, role]) => ({
          membershipId,
          role,
        })),
      ),
    onSuccess: (result) => {
      invalidate();
      if (result.failed.length === 0) {
        onClose();
        return;
      }
      setFailures(result.failed);
      setSelected((current) => {
        const next = new Map(current);
        for (const id of result.succeededMembershipIds) {
          next.delete(id);
        }
        return next;
      });
    },
  });

  const assignedMembershipIds =
    projectQuery.data?.members.map((member) => member.membershipId) ?? [];
  const availableMembers = (membersQuery.data ?? []).filter(
    (member) => !assignedMembershipIds.includes(member.id),
  );
  const isLoading = projectQuery.isLoading || membersQuery.isLoading;

  function nameFor(membershipId: string): string {
    const member = (membersQuery.data ?? []).find((candidate) => candidate.id === membershipId);
    return member ? (member.name ?? member.email) : membershipId;
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    setFailures([]);
    mutation.mutate();
  }

  return (
    <Modal title="Add members to project" onClose={onClose}>
      <div className="flex w-full max-w-lg flex-col gap-4">
        <p className="text-sm text-slate-900/70">
          Check as many people as you like, set each one&apos;s role, then add them all at once.
        </p>

        {failures.length > 0 && (
          <ErrorMessage
            message={`Couldn't add ${failures.length} member${failures.length === 1 ? "" : "s"}: ${failures
              .map((failure) => `${nameFor(failure.membershipId)} (${failure.message})`)
              .join(", ")}`}
          />
        )}

        <MemberSearchChecklist
          roleOptions={PROJECT_MEMBERSHIP_ROLE_OPTIONS}
          candidates={availableMembers}
          selected={selected}
          isLoading={isLoading}
          emptyMessage="Every active member is already assigned to this project."
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

        <button
          type="button"
          onClick={handleSubmit}
          disabled={mutation.isPending || selected.size === 0}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50 border-2 border-ink font-bold"
        >
          {mutation.isPending && <Spinner />}
          {selected.size === 0
            ? "Add to project"
            : `Add ${selected.size} member${selected.size === 1 ? "" : "s"} to project`}
        </button>
      </div>
    </Modal>
  );
}
