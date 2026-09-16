"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useProject } from "@/hooks/useProject";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectDetailHeader } from "./ProjectDetailHeader";
import { ProjectMembersSection } from "./ProjectMembersSection";
import { ProjectTasksSection } from "./ProjectTasksSection";
import { ProjectTeamsSection } from "./ProjectTeamsSection";
import { Spinner } from "./Spinner";

type ProjectDetailContentProps = {
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

export function ProjectDetailContent({
  organisationId,
  projectId,
}: ProjectDetailContentProps) {
  const projectQuery = useProject(organisationId, projectId);
  const organisationQuery = useCurrentOrganisation();

  if (projectQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <BackToProjectsLink organisationId={organisationId} />
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading project…
        </p>
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="flex flex-col gap-6">
        <BackToProjectsLink organisationId={organisationId} />
        <ErrorMessage
          message={
            projectQuery.error instanceof Error
              ? projectQuery.error.message
              : "Could not load this project."
          }
        />
      </div>
    );
  }

  const project = projectQuery.data;
  const callerRole = organisationQuery.data?.role;
  const callerUserId = organisationQuery.data?.userId;
  const ownMembership = project.members.find(
    (member) => member.userId === callerUserId,
  );
  const canManage =
    callerRole === "admin" ||
    callerRole === "manager" ||
    ownMembership?.role === "manager";

  return (
    <div className="flex flex-col gap-8">
      <BackToProjectsLink organisationId={organisationId} />

      <ProjectDetailHeader
        organisationId={organisationId}
        project={project}
        canManage={canManage}
      />

      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-slate-900/70">Client</dt>
          <dd className="text-slate-900">{project.client ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-900/70">Billing</dt>
          <dd className="text-slate-900">
            {project.billable
              ? `Billable${project.rate ? ` — $${project.rate}/hr default` : ""}`
              : "Not billable"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-slate-900/70">Description</dt>
          <dd className="text-slate-900">{project.description ?? "—"}</dd>
        </div>
      </dl>

      <ProjectMembersSection
        organisationId={organisationId}
        project={project}
        canManage={canManage}
      />

      <ProjectTeamsSection
        organisationId={organisationId}
        project={project}
        canManage={canManage}
      />

      <ProjectTasksSection organisationId={organisationId} projectId={projectId} />
    </div>
  );
}
