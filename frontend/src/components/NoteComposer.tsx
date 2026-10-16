"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useProjects } from "@/hooks/useProjects";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { createNote } from "@/lib/createNote";
import { SelectField } from "@/components/ui/form/SelectField";
import { TextField } from "@/components/ui/form/TextField";
import { Spinner } from "@/components/Spinner";

type NoteComposerProps = {
  organisationId: string;
  noteDate: string;
  onCreated: () => void;
};

export function NoteComposer({
  organisationId,
  noteDate,
  onCreated,
}: NoteComposerProps) {
  const projectsEnabled = useProjectsEnabled();
  const [projectId, setProjectId] = useState("");
  const queryClient = useQueryClient();
  const projectsQuery = useProjects(organisationId, { status: "active" });

  const createMutation = useMutation({
    mutationFn: (content: string) =>
      createNote(organisationId, {
        noteDate,
        projectId: projectId || undefined,
        content,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({
          queryKey: ["notes", organisationId],
        });
        onCreated();
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") ?? "").trim();
    if (!content) return;

    createMutation.mutate(content, {
      onSuccess: (result) => {
        if (result.ok) {
          form.reset();
          setProjectId("");
        }
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <TextField
          label="What are you working on?"
          name="content"
          type="text"
          placeholder="What are you working on?"
          required
          className="flex-1"
        />
        {projectsEnabled && (
          <SelectField
            label="Project (optional)"
            compact
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">No project</option>
            {projectsQuery.data?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SelectField>
        )}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50 border-2 border-ink font-bold"
        >
          {createMutation.isPending && <Spinner />}
          {createMutation.isPending ? "Posting…" : "Add note"}
        </button>
      </div>
    </form>
  );
}
