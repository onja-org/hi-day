"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProjects } from "@/hooks/useProjects";
import { Label } from "@/components/ui/form/Label";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectTaskBoard } from "./ProjectTaskBoard";
import { SearchableSelect } from "./SearchableSelect";
import { SegmentedControl } from "./SegmentedControl";
import { Spinner } from "./Spinner";

type TasksPageContentProps = {
  organisationId: string;
};

type TasksView = "list" | "kanban";

/**
 * Tasks across the caller's projects. The chosen project and view live in
 * the query string (`?project=…&view=kanban`) so a board can be linked to
 * and survives a reload. The project list is already scoped server-side:
 * admins/managers see every project, everyone else only theirs.
 */
export function TasksPageContent({ organisationId }: TasksPageContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectsQuery = useProjects(organisationId, { status: "active" });

  const view: TasksView = searchParams.get("view") === "kanban" ? "kanban" : "list";
  const projects = projectsQuery.data ?? [];
  const requestedProjectId = searchParams.get("project");
  const projectId =
    projects.find((project) => project.id === requestedProjectId)?.id ?? projects[0]?.id ?? null;

  function updateQuery(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-primary-dark">Tasks</h1>
        <SegmentedControl
          label="Task view"
          options={[
            { key: "list", label: "List" },
            { key: "kanban", label: "Kanban" },
          ]}
          value={view}
          onChange={(next) => updateQuery({ view: next })}
        />
      </div>

      {projectsQuery.isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading projects…
        </p>
      )}
      {projectsQuery.isError && (
        <ErrorMessage
          message={projectsQuery.error instanceof Error ? projectsQuery.error.message : "Could not load projects."}
        />
      )}
      {projectsQuery.data && !projectId && (
        <p className="text-slate-900">You&apos;re not on any active projects yet, so there are no tasks to show.</p>
      )}

      {projectId && (
        <>
          <div className="flex flex-col gap-1">
            <Label>Project</Label>
            <SearchableSelect
              value={projectId}
              onChange={(value) => updateQuery({ project: value })}
              ariaLabel="Project"
              placeholder="Search projects…"
              noMatchesLabel="No matching projects"
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
            />
          </div>
          <ProjectTaskBoard key={projectId} organisationId={organisationId} projectId={projectId} view={view} />
        </>
      )}
    </div>
  );
}
