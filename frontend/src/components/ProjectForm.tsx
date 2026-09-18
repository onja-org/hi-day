"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "@/lib/createProject";
import { updateProject } from "@/lib/updateProject";
import { PROJECT_QUERY_KEY } from "@/hooks/useProject";
import type { Project, ProjectColour, ProjectFormInput } from "@/types/project";
import { ProjectColourPicker } from "./ProjectColourPicker";
import { Spinner } from "./Spinner";

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
  const [colour, setColour] = useState<ProjectColour>(project?.colour ?? "blue");
  const [billable, setBillable] = useState(project?.billable ?? false);

  const mutation = useMutation({
    mutationFn: (input: ProjectFormInput) =>
      mode === "create"
        ? createProject(organisationId, input)
        : updateProject(organisationId, project.id, input),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["projects", organisationId] });
        if (mode === "edit") {
          queryClient.invalidateQueries({
            queryKey: PROJECT_QUERY_KEY(organisationId, project.id),
          });
        }
        onSaved(result.project);
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

    const client = String(formData.get("client") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const rate = String(formData.get("rate") ?? "").trim();

    mutation.mutate({
      name,
      client: client || undefined,
      description: description || undefined,
      colour,
      billable,
      rate: rate || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        Name
        <input
          name="name"
          type="text"
          required
          maxLength={255}
          defaultValue={project?.name}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Client (optional)
        <input
          name="client"
          type="text"
          maxLength={255}
          defaultValue={project?.client ?? ""}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Description (optional)
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={project?.description ?? ""}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        Colour
        <ProjectColourPicker value={colour} onChange={setColour} />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={billable}
          onChange={(event) => setBillable(event.target.checked)}
          className="h-4 w-4 rounded border-input-border"
        />
        Billable
      </label>

      <label className="flex flex-col gap-1.5">
        Default rate (optional)
        <input
          name="rate"
          type="number"
          min="0"
          step="0.01"
          defaultValue={project?.rate ?? ""}
          placeholder="0.00"
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
      >
        {mutation.isPending && <Spinner />}
        {mode === "create" ? "Create project" : "Save changes"}
      </button>
    </form>
  );
}
