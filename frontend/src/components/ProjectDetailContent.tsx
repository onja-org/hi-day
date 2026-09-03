"use client";

import { useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { ArchiveProjectButton } from "./ArchiveProjectButton";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectMembersSection } from "./ProjectMembersSection";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
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
  const [editOpen, setEditOpen] = useState(false);
  const projectQuery = useProject(organisationId, projectId);

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

  return (
    <div className="flex flex-col gap-8">
      <BackToProjectsLink organisationId={organisationId} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ProjectColourBadge colour={project.colour} className="h-4 w-4" />
          <h1 className="text-2xl font-semibold text-primary-dark">{project.name}</h1>
          <ProjectStatusBadge status={project.status} />
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            disabled={project.status === "archived"}
            title={
              project.status === "archived"
                ? "Unarchive this project to edit it."
                : undefined
            }
            className="cursor-pointer rounded-md border border-primary px-3 py-1.5 text-sm text-primary transition-colors duration-150 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit
          </button>
          <ArchiveProjectButton organisationId={organisationId} project={project} />
        </div>
      </div>

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

      <ProjectMembersSection organisationId={organisationId} project={project} />

      {editOpen && (
        <ProjectFormModal
          organisationId={organisationId}
          project={project}
          onClose={() => setEditOpen(false)}
          onSaved={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
