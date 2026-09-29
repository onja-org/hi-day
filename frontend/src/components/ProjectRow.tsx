"use client";

import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { getInitials } from "@/lib/getInitials";
import type { ProjectOverviewItem } from "@/types/project";
import { AvatarStack } from "./AvatarStack";
import { EditIconButton } from "./EditIconButton";
import { ProjectAssignmentsModal } from "./ProjectAssignmentsModal";
import { PROJECT_COLOUR_BG_CLASSES } from "./ProjectColourBadge";
import { ProjectRowActions } from "./ProjectRowActions";
import { ProjectTasksSection } from "./ProjectTasksSection";

type ProjectRowProps = {
  organisationId: string;
  project: ProjectOverviewItem;
  canManage: boolean;
  /** Including the selection checkbox column, when shown. */
  columnCount: number;
  selected: boolean;
  onToggleSelected: () => void;
};

export function ProjectRow({
  organisationId,
  project,
  canManage,
  columnCount,
  selected,
  onToggleSelected,
}: ProjectRowProps) {
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [editing, setEditing] = useState<"members" | "teams" | null>(null);
  const canEditAssignments = canManage && project.status === "active";

  return (
    <>
      <tr className="group border-b border-input-border last:border-b-0 hover:bg-cream/30">
        {canManage && (
          <td className="w-10 py-3 pl-4">
            <input
              type="checkbox"
              aria-label={`Select ${project.name}`}
              checked={selected}
              onChange={onToggleSelected}
              className="cursor-pointer accent-primary"
            />
          </td>
        )}
        <td className="px-4 py-3">
          <Link
            href={`/organisations/${organisationId}/projects/${project.id}`}
            title="Open project details"
            className="flex w-fit items-center gap-3 font-medium text-primary hover:text-primary/80"
          >
            <span
              aria-hidden="true"
              className={clsx(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                PROJECT_COLOUR_BG_CLASSES[project.colour],
              )}
            >
              {getInitials(project.name).charAt(0)}
            </span>
            {project.name}
          </Link>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="flex items-center gap-1.5">
            <AvatarStack
              tone="secondary"
              items={project.teams.map((team) => ({
                id: team.id,
                label: team.name,
                initials: getInitials(team.name).charAt(0),
              }))}
            />
            {canEditAssignments && (
              <EditIconButton
                label="Edit this project's teams"
                accessibleName={`Edit ${project.name}'s teams`}
                onClick={() => setEditing("teams")}
              />
            )}
          </div>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="flex items-center gap-1.5">
            <AvatarStack
              items={project.members.map((member) => ({
                id: member.id,
                label: member.name ?? member.email,
                initials: getInitials(member.name, member.email),
              }))}
            />
            {canEditAssignments && (
              <EditIconButton
                label="Edit this project's members"
                accessibleName={`Edit ${project.name}'s members`}
                onClick={() => setEditing("members")}
              />
            )}
          </div>
        </td>
        <td className="hidden px-4 py-3 sm:table-cell">
          <button
            type="button"
            onClick={() => setTasksExpanded((value) => !value)}
            aria-expanded={tasksExpanded}
            className="flex cursor-pointer items-center gap-1.5 text-slate-900 hover:text-primary"
          >
            {tasksExpanded ? (
              <CaretDown size={14} aria-hidden="true" />
            ) : (
              <CaretRight size={14} aria-hidden="true" />
            )}
            {project.taskCount === 0
              ? "No tasks"
              : `${project.taskCount} ${project.taskCount === 1 ? "task" : "tasks"}`}
          </button>
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          {canManage && (
            <ProjectRowActions organisationId={organisationId} project={project} />
          )}
        </td>
      </tr>
      {tasksExpanded && (
        <tr className="border-b border-input-border bg-cream/40 last:border-b-0">
          <td colSpan={columnCount} className="px-4 py-4">
            <ProjectTasksSection organisationId={organisationId} projectId={project.id} />
          </td>
        </tr>
      )}
      {editing && (
        <ProjectAssignmentsModal
          organisationId={organisationId}
          projectId={project.id}
          projectName={project.name}
          kind={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
