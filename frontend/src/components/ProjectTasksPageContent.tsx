"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { ProjectTasksSection } from "./ProjectTasksSection";
import { Spinner } from "./Spinner";

type ProjectTasksPageContentProps = {
  organisationId: string;
  projectId: string;
};

function BackToProjectsLink({ organisationId }: { organisationId: string }) {
  return (
    <Link
      href={`/organisations/${organisationId}/projects`}
      className="flex w-fit cursor-pointer items-center gap-2 text-sm text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-dark hover:underline"
    >
      <ArrowLeftIcon size={16} aria-hidden="true" />
      Back to projects
    </Link>
  );
}

export function ProjectTasksPageContent({
  organisationId,
  projectId,
}: ProjectTasksPageContentProps) {
  const tasksQuery = useProjectTasks(organisationId, projectId);

  if (tasksQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <BackToProjectsLink organisationId={organisationId} />
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading tasks…
        </p>
      </div>
    );
  }

  if (tasksQuery.isError || !tasksQuery.data) {
    return (
      <div className="flex flex-col gap-6">
        <BackToProjectsLink organisationId={organisationId} />
        <ErrorMessage
          message={
            tasksQuery.error instanceof Error
              ? tasksQuery.error.message
              : "Could not load this project's tasks."
          }
        />
      </div>
    );
  }

  const { project } = tasksQuery.data;

  return (
    <div className="flex flex-col gap-8">
      <BackToProjectsLink organisationId={organisationId} />

      <div className="flex items-center gap-3">
        <ProjectColourBadge colour={project.colour} className="h-4 w-4" />
        <h1 className="text-2xl font-semibold text-primary-dark">{project.name}</h1>
        <ProjectStatusBadge status={project.status} />
      </div>

      <ProjectTasksSection organisationId={organisationId} projectId={projectId} />
    </div>
  );
}
