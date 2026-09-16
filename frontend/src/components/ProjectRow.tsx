"use client";

import { useState } from "react";
import { ArrowSquareOut, CaretDown, CaretRight } from "@phosphor-icons/react";
import Link from "next/link";
import type { ProjectListItem } from "@/types/project";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { ProjectRowActions } from "./ProjectRowActions";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { ProjectTasksSection } from "./ProjectTasksSection";

type ProjectRowProps = {
  organisationId: string;
  project: ProjectListItem;
  canManage: boolean;
};

export function ProjectRow({ organisationId, project, canManage }: ProjectRowProps) {
  const [tasksExpanded, setTasksExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-input-border last:border-b-0">
        <td className="px-3 py-2">
          <Link
            href={`/organisations/${organisationId}/projects/${project.id}`}
            title="Open project details"
            className="group flex w-fit items-center gap-2 text-slate-900 hover:text-primary"
          >
            <ProjectColourBadge colour={project.colour} />
            {project.name}
            <ArrowSquareOut
              size={14}
              aria-hidden="true"
              className="text-primary-dark/40 transition-colors duration-150 group-hover:text-primary"
            />
          </Link>
        </td>
        <td className="px-3 py-2 text-slate-900">{project.client ?? "—"}</td>
        <td className="px-3 py-2">
          <ProjectStatusBadge status={project.status} />
        </td>
        <td className="px-3 py-2">
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
            {project.taskCount} {project.taskCount === 1 ? "task" : "tasks"}
          </button>
        </td>
        <td className="px-3 py-2 text-slate-900">
          {project.billable ? (project.rate ? `$${project.rate}/hr` : "Billable") : "Not billable"}
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          {canManage && (
            <ProjectRowActions organisationId={organisationId} project={project} />
          )}
        </td>
      </tr>
      {tasksExpanded && (
        <tr className="border-b border-input-border bg-cream/40 last:border-b-0">
          <td colSpan={6} className="px-3 py-4">
            <ProjectTasksSection organisationId={organisationId} projectId={project.id} />
          </td>
        </tr>
      )}
    </>
  );
}
