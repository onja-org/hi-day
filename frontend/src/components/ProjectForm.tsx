"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "@/lib/createProject";
import { syncProjectAssignments } from "@/lib/syncProjectAssignments";
import { updateProject } from "@/lib/updateProject";
import { PROJECT_QUERY_KEY, useProject } from "@/hooks/useProject";
import type {
  Project,
  ProjectColour,
  ProjectFormInput,
  ProjectMembershipRole,
} from "@/types/project";
import { ErrorMessage } from "@/components/ErrorMessage";
import { TextareaField } from "@/components/ui/form/TextareaField";
import { TextField } from "@/components/ui/form/TextField";
import { ProjectAssignmentFields } from "@/components/ProjectAssignmentFields";
import { ProjectColourPicker } from "@/components/ProjectColourPicker";
import { Spinner } from "@/components/Spinner";

type ProjectFormProps =
  | {
      organisationId: string;
      mode: "create";
      project?: undefined;
      onSaved: (project: Project) => void;
    }
  | {
      organisationId: string;
      mode: "edit";
      project: Project;
      onSaved: (project: Project) => void;
    };

export function ProjectForm({
  organisationId,
  mode,
  project,
  onSaved,
}: ProjectFormProps) {
  const queryClient = useQueryClient();
  const [colour, setColour] = useState<ProjectColour>(
    project?.colour ?? "blue",
  );
  const [selectedMembers, setSelectedMembers] = useState<
    Map<string, ProjectMembershipRole>
  >(new Map());
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(
    new Set(),
  );

  const projectDetailQuery = useProject(organisationId, project?.id ?? "", {
    enabled: mode === "edit",
  });

  const seededAssignmentsRef = useRef(false);
  useEffect(() => {
    if (
      mode === "edit" &&
      !seededAssignmentsRef.current &&
      projectDetailQuery.data
    ) {
      seededAssignmentsRef.current = true;
      setSelectedMembers(
        new Map(
          projectDetailQuery.data.members.map((member) => [
            member.membershipId,
            member.role,
          ]),
        ),
      );
      setSelectedTeamIds(
        new Set(projectDetailQuery.data.teams.map((team) => team.teamId)),
      );
    }
  }, [mode, projectDetailQuery.data]);

  const mutation = useMutation({
    mutationFn: async (input: ProjectFormInput) => {
      if (mode === "create") {
        const result = await createProject(organisationId, input);
        return { ...result, assignmentFailures: [] as string[] };
      }

      const result = await updateProject(organisationId, project.id, input);
      if (!result.ok || !projectDetailQuery.data) {
        return { ...result, assignmentFailures: [] as string[] };
      }

      const syncResult = await syncProjectAssignments(
        organisationId,
        project.id,
        projectDetailQuery.data.members,
        selectedMembers,
        projectDetailQuery.data.teams,
        selectedTeamIds,
      );
      return { ...result, assignmentFailures: syncResult.failures };
    },
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: ["projects", organisationId],
        });
        if (mode === "edit") {
          queryClient.invalidateQueries({
            queryKey: PROJECT_QUERY_KEY(organisationId, project.id),
          });
        }
        if (result.assignmentFailures.length === 0) {
          onSaved(result.project);
        }
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return;
    }

    const description = String(formData.get("description") ?? "").trim();

    mutation.mutate({
      name,
      description: description || undefined,
      colour,
      ...(mode === "create" && {
        members: [...selectedMembers.entries()].map(([membershipId, role]) => ({
          membershipId,
          role,
        })),
        teamIds: [...selectedTeamIds],
      }),
    });
  }

  const assignmentsNotReady =
    mode === "edit" &&
    (projectDetailQuery.isLoading || projectDetailQuery.isError);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-5"
    >
      <TextField
        label="Name"
        name="name"
        type="text"
        required
        maxLength={255}
        defaultValue={project?.name}
      />

      <TextareaField
        label="Description (optional)"
        name="description"
        rows={3}
        maxLength={2000}
        defaultValue={project?.description ?? ""}
      />

      <div className="flex flex-col gap-1.5">
        Colour
        <ProjectColourPicker value={colour} onChange={setColour} />
      </div>

      {mode === "create" && (
        <ProjectAssignmentFields
          organisationId={organisationId}
          selectedMembers={selectedMembers}
          onMembersChange={setSelectedMembers}
          selectedTeamIds={selectedTeamIds}
          onTeamIdsChange={setSelectedTeamIds}
        />
      )}

      {mode === "edit" && projectDetailQuery.isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading members &amp; teams…
        </p>
      )}

      {mode === "edit" && projectDetailQuery.isError && (
        <ErrorMessage message="Could not load this project's members and teams." />
      )}

      {mode === "edit" && projectDetailQuery.data && (
        <ProjectAssignmentFields
          organisationId={organisationId}
          projectId={project.id}
          selectedMembers={selectedMembers}
          onMembersChange={setSelectedMembers}
          selectedTeamIds={selectedTeamIds}
          onTeamIdsChange={setSelectedTeamIds}
        />
      )}

      {mutation.data?.ok && mutation.data.assignmentFailures.length > 0 && (
        <ErrorMessage
          message={`Project saved, but ${mutation.data.assignmentFailures.length} membership/team change${
            mutation.data.assignmentFailures.length === 1 ? "" : "s"
          } failed: ${mutation.data.assignmentFailures.join("; ")}`}
        />
      )}

      <button
        type="submit"
        disabled={mutation.isPending || assignmentsNotReady}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50 border-2 border-ink font-bold"
      >
        {mutation.isPending && <Spinner />}
        {mode === "create" ? "Create project" : "Save changes"}
      </button>
    </form>
  );
}
