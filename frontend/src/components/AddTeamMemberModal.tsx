"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { addTeamMembers } from "@/lib/addTeamMembers";
import type { TeamMember } from "@/types/team";
import { ErrorMessage } from "./ErrorMessage";
import { MemberSearchChecklist } from "./MemberSearchChecklist";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type AddTeamMemberModalProps = {
  organisationId: string;
  teamId: string;
  existingMembers: TeamMember[];
  onClose: () => void;
};

export function AddTeamMemberModal({
  organisationId,
  teamId,
  existingMembers,
  onClose,
}: AddTeamMemberModalProps) {
  const invalidate = useInvalidateTeams(organisationId);
  const membersQuery = useActiveMembers(organisationId);
  // membershipId -> role, for every currently-checked candidate — presence
  // in the map is "checked", the value is that row's own role choice, so
  // one batch can add both plain members and team managers together.
  const [selected, setSelected] = useState<Map<string, "member" | "manager">>(new Map());
  const [failures, setFailures] = useState<{ membershipId: string; message: string }[]>([]);

  const addMutation = useMutation({
    mutationFn: () =>
      addTeamMembers(
        organisationId,
        teamId,
        [...selected.entries()].map(([membershipId, role]) => ({
          membershipId,
          isManager: role === "manager",
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

  const existingMembershipIds = new Set(
    existingMembers.map((member) => member.membershipId),
  );
  const candidates = (membersQuery.data ?? []).filter(
    (member) => !existingMembershipIds.has(member.id),
  );

  function nameFor(membershipId: string): string {
    const member = (membersQuery.data ?? []).find((candidate) => candidate.id === membershipId);
    return member ? (member.name ?? member.email) : membershipId;
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    setFailures([]);
    addMutation.mutate();
  }

  return (
    <Modal title="Add members" onClose={onClose}>
      <div className="flex flex-col gap-4">
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
          candidates={candidates}
          selected={selected}
          isLoading={membersQuery.isLoading}
          emptyMessage="Every active member is already on this team."
          managerLabel="Team manager"
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
          disabled={addMutation.isPending || selected.size === 0}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {addMutation.isPending && <Spinner />}
          {selected.size === 0
            ? "Add members"
            : `Add ${selected.size} member${selected.size === 1 ? "" : "s"}`}
        </button>
      </div>
    </Modal>
  );
}
