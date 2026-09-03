"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { TEAM_DETAIL_QUERY_KEY } from "@/hooks/useTeamDetail";
import { addTeamMember } from "@/lib/addTeamMember";
import type { TeamMember } from "@/types/team";
import { ErrorMessage } from "./ErrorMessage";
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
  const queryClient = useQueryClient();
  const membersQuery = useActiveMembers(organisationId);
  const [search, setSearch] = useState("");

  const addMutation = useMutation({
    mutationFn: (membershipId: string) =>
      addTeamMember(organisationId, teamId, { membershipId }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: TEAM_DETAIL_QUERY_KEY(organisationId, teamId),
        });
      }
    },
  });

  const existingMembershipIds = new Set(
    existingMembers.map((member) => member.membershipId),
  );
  const search_ = search.trim().toLowerCase();
  const candidates = (membersQuery.data ?? [])
    .filter((member) => !existingMembershipIds.has(member.id))
    .filter((member) => {
      if (!search_) {
        return true;
      }
      return [member.name, member.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search_));
    });

  return (
    <Modal title="Add member" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="sr-only" htmlFor="add-member-search">
          Search members
        </label>
        <input
          id="add-member-search"
          type="search"
          placeholder="Search by name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-md border border-input-border px-3 py-2 text-sm text-slate-900"
        />

        {addMutation.data && !addMutation.data.ok && (
          <ErrorMessage message={addMutation.data.message} />
        )}

        {membersQuery.isLoading ? (
          <p className="flex items-center gap-2 text-slate-900">
            <Spinner className="text-primary-dark" />
            Loading members…
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {candidates.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-md border border-input-border px-3 py-2 text-slate-900"
              >
                <span>
                  {member.name ?? member.email}
                  {member.name && (
                    <span className="block text-xs text-slate-900/70">
                      {member.email}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => addMutation.mutate(member.id)}
                  disabled={addMutation.isPending}
                  className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
                >
                  Add
                </button>
              </li>
            ))}
            {candidates.length === 0 && (
              <li className="text-slate-900">
                {search_
                  ? "No members match your search."
                  : "Every active member is already on this team."}
              </li>
            )}
          </ul>
        )}
      </div>
    </Modal>
  );
}
