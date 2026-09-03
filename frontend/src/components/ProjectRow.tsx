import Link from "next/link";
import type { Project } from "@/types/project";
import { ArchiveProjectButton } from "./ArchiveProjectButton";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

type ProjectRowProps = {
  organisationId: string;
  project: Project;
};

export function ProjectRow({ organisationId, project }: ProjectRowProps) {
  return (
    <tr className="border-b border-input-border last:border-b-0">
      <td className="px-3 py-2">
        <Link
          href={`/organisations/${organisationId}/projects/${project.id}`}
          className="flex items-center gap-2 text-slate-900 hover:text-primary"
        >
          <ProjectColourBadge colour={project.colour} />
          {project.name}
        </Link>
      </td>
      <td className="px-3 py-2 text-slate-900">{project.client ?? "—"}</td>
      <td className="px-3 py-2">
        <ProjectStatusBadge status={project.status} />
      </td>
      <td className="px-3 py-2 text-slate-900">
        {project.billable ? (project.rate ? `$${project.rate}/hr` : "Billable") : "Not billable"}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <ArchiveProjectButton organisationId={organisationId} project={project} />
      </td>
    </tr>
  );
}
