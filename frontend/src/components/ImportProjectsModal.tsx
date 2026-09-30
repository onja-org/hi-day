"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAssignableProjectMembers } from "@/hooks/useAssignableProjectMembers";
import { useAssignableProjectTeams } from "@/hooks/useAssignableProjectTeams";
import { useInvalidateProjects } from "@/hooks/useInvalidateProjects";
import { useProjects } from "@/hooks/useProjects";
import { createProject } from "@/lib/createProject";
import { parseProjectImportRows } from "@/lib/parseProjectImportRows";
import type { ProjectImportRow } from "@/lib/parseProjectImportRows";
import { projectImportTemplateCsv } from "@/lib/projectImportTemplateCsv";
import { readImportFile } from "@/lib/readImportFile";
import { runProjectBatch } from "@/lib/runProjectBatch";
import { ErrorMessage } from "./ErrorMessage";
import { ImportTemplateButton } from "./ImportTemplateButton";
import { Modal } from "./Modal";
import { ProjectBatchResultsList } from "./ProjectBatchResultsList";
import { ProjectImportPreviewTable } from "./ProjectImportPreviewTable";
import { Spinner } from "./Spinner";

type ImportProjectsModalProps = {
  organisationId: string;
  onClose: () => void;
};

export function ImportProjectsModal({ organisationId, onClose }: ImportProjectsModalProps) {
  const invalidateProjects = useInvalidateProjects(organisationId);
  const teamsQuery = useAssignableProjectTeams(organisationId);
  const membersQuery = useAssignableProjectMembers(organisationId);
  const projectsQuery = useProjects(organisationId, { status: "all" });
  const [rows, setRows] = useState<ProjectImportRow[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const teams = teamsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const validRows = (rows ?? []).filter((row) => row.input !== null);

  const mutation = useMutation({
    // `line` stands in for an id: a project has none until it's created.
    mutationFn: () =>
      runProjectBatch(
        validRows.map((row) => ({ id: String(row.line), name: row.name, input: row.input! })),
        async (row) => {
          const result = await createProject(organisationId, row.input);
          return result.ok ? { ok: true, message: "Created" } : result;
        },
        "Imported",
      ),
    onSettled: () => invalidateProjects(),
  });

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRows(null);
    setFileError(null);
    if (!file) return;
    try {
      const parsed = parseProjectImportRows(await readImportFile(file), {
        teams,
        members,
        existingProjectNames: (projectsQuery.data ?? []).map((project) => project.name),
      });
      if (parsed.headerError) setFileError(parsed.headerError);
      else if (parsed.rows.length === 0) setFileError("That file has no project rows.");
      else setRows(parsed.rows);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Couldn't read that file.");
    }
  }

  const lookupsLoading = teamsQuery.isLoading || membersQuery.isLoading || projectsQuery.isLoading;
  const lookupsError = teamsQuery.isError || membersQuery.isError || projectsQuery.isError;

  return (
    <Modal title="Import projects" onClose={onClose} size="wide">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-900">
          Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file. The first row names the
          columns: <code>name</code> (required), <code>description</code>, <code>colour</code>{" "}
          (blue, green, amber, red, purple, teal, pink or gray), <code>teams</code> (team names)
          and <code>members</code> (member emails) — list several separated by <code>;</code>.
          Members join as project members.
        </p>
        <ImportTemplateButton
          filename="projects-import-template.csv"
          buildCsv={() =>
            projectImportTemplateCsv(
              teams.map((team) => team.name),
              members.map((member) => member.email),
            )
          }
        />

        {lookupsError && <ErrorMessage message="Couldn't load teams, members or projects." />}

        {mutation.data ? (
          <ProjectBatchResultsList outcomes={mutation.data.outcomes} />
        ) : (
          <label className="flex flex-col gap-1.5 text-sm text-slate-900">
            File
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFile}
              disabled={lookupsLoading || lookupsError}
              className="rounded-md border border-input-border px-3 py-2 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-primary"
            />
          </label>
        )}

        {fileError && <ErrorMessage message={fileError} />}
        {rows && !mutation.data && <ProjectImportPreviewTable rows={rows} />}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-input-border px-4 h-11 text-slate-900"
          >
            {mutation.data ? "Done" : "Cancel"}
          </button>
          {rows && !mutation.data && (
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={validRows.length === 0 || mutation.isPending}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending && <Spinner />}
              Import {validRows.length} {validRows.length === 1 ? "project" : "projects"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
