"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useInvalidateProject } from "@/hooks/useInvalidateProject";
import { removeProjectTeam } from "@/lib/removeProjectTeam";
import type { ProjectDetail } from "@/types/project";
import { AddProjectTeamModal } from "./AddProjectTeamModal";

type ProjectTeamsSectionProps = {
  organisationId: string;
  project: ProjectDetail;
  canManage: boolean;
};

export function ProjectTeamsSection({
  organisationId,
  project,
  canManage,
}: ProjectTeamsSectionProps) {
  const invalidate = useInvalidateProject(organisationId, project.id);
  const [addOpen, setAddOpen] = useState(false);
  const isArchived = project.status === "archived";

  const removeMutation = useMutation({
    mutationFn: (teamId: string) =>
      removeProjectTeam(organisationId, project.id, teamId),
    onSuccess: invalidate,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-primary-dark">Teams</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={isArchived}
            title={isArchived ? "Unarchive this project to change teams." : undefined}
            className="cursor-pointer rounded-md border border-primary px-3 h-11 text-sm text-primary transition-colors duration-150 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add team
          </button>
        )}
      </div>

      <p className="text-sm text-slate-900/70">
        Everyone on an assigned team can log time and be assigned tasks on
        this project.
      </p>

      <ul className="flex flex-col gap-2">
        {project.teams.map((team) => (
          <li
            key={team.id}
            className="flex items-center justify-between gap-3 rounded-md border border-input-border px-3 py-2 text-slate-900"
          >
            {team.name}
            {canManage && (
              <button
                type="button"
                onClick={() => removeMutation.mutate(team.teamId)}
                disabled={isArchived || removeMutation.isPending}
                className="cursor-pointer text-error underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </li>
        ))}
        {project.teams.length === 0 && (
          <li className="text-center text-slate-900">No teams assigned yet.</li>
        )}
      </ul>

      {addOpen && (
        <AddProjectTeamModal
          organisationId={organisationId}
          projectId={project.id}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
