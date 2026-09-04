"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PROJECT_QUERY_KEY } from "@/hooks/useProject";
import { removeProjectMember } from "@/lib/removeProjectMember";
import { updateProjectMember } from "@/lib/updateProjectMember";
import type { ProjectDetail, ProjectMembershipRole } from "@/types/project";
import { AddProjectMemberModal } from "./AddProjectMemberModal";

type ProjectMembersSectionProps = {
  organisationId: string;
  project: ProjectDetail;
  canManage: boolean;
};

export function ProjectMembersSection({
  organisationId,
  project,
  canManage,
}: ProjectMembersSectionProps) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const isArchived = project.status === "archived";

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) =>
      removeProjectMember(organisationId, project.id, membershipId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: PROJECT_QUERY_KEY(organisationId, project.id),
      }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      membershipId,
      role,
    }: {
      membershipId: string;
      role: ProjectMembershipRole;
    }) => updateProjectMember(organisationId, project.id, membershipId, { role }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: PROJECT_QUERY_KEY(organisationId, project.id),
      }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-primary-dark">Members</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={isArchived}
            title={isArchived ? "Unarchive this project to change members." : undefined}
            className="cursor-pointer rounded-md border border-primary px-3 py-1.5 text-sm text-primary transition-colors duration-150 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add member
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-input-border">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-input-border text-slate-900">
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Rate</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {project.members.map((member) => (
              <tr key={member.membershipId} className="border-b border-input-border last:border-b-0">
                <td className="px-3 py-2 text-slate-900">
                  {member.name ?? member.email}
                  {member.name && (
                    <span className="block text-xs text-slate-900/70">{member.email}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-900">
                  {canManage ? (
                    <>
                      <label className="sr-only" htmlFor={`role-${member.membershipId}`}>
                        Role for {member.name ?? member.email}
                      </label>
                      <select
                        id={`role-${member.membershipId}`}
                        value={member.role}
                        onChange={(event) =>
                          updateRoleMutation.mutate({
                            membershipId: member.membershipId,
                            role: event.target.value as ProjectMembershipRole,
                          })
                        }
                        disabled={isArchived || updateRoleMutation.isPending}
                        className="rounded-md border border-input-border bg-white px-2 py-1 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="member">Member</option>
                        <option value="manager">Manager</option>
                      </select>
                    </>
                  ) : (
                    <span className="capitalize">{member.role}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-900">
                  {member.effectiveRate
                    ? `$${member.effectiveRate}/hr${member.rate ? " (override)" : ""}`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(member.membershipId)}
                      disabled={isArchived || removeMutation.isPending}
                      className="cursor-pointer text-error underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {project.members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-900">
                  No members assigned yet. Only assigned members can log time to this project.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddProjectMemberModal
          organisationId={organisationId}
          projectId={project.id}
          assignedMembershipIds={project.members.map((member) => member.membershipId)}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
