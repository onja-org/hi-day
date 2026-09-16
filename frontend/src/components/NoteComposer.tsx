"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useProjects } from "@/hooks/useProjects";
import { createNote } from "@/lib/createNote";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type NoteComposerProps = {
  organisationId: string;
  /** The day this note is written for — always the day the page currently
   * shows, not a separately-editable field in this form. */
  noteDate: string;
  onCreated: () => void;
};

/** A note's day comes from whichever day the page is currently showing —
 * "write a note about the day you're looking at" — so this form only asks
 * for an optional project and the note's content. */
export function NoteComposer({ organisationId, noteDate, onCreated }: NoteComposerProps) {
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
        void queryClient.invalidateQueries({ queryKey: ["notes", organisationId] });
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
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="note-content">
          What are you working on?
        </label>
        <input
          id="note-content"
          name="content"
          type="text"
          placeholder="What are you working on?"
          required
          className="flex-1 rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          aria-label="Project (optional)"
          className="rounded-md border border-input-border bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="">No project</option>
          {projectsQuery.data?.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {createMutation.isPending && <Spinner />}
          {createMutation.isPending ? "Posting…" : "Add note"}
        </button>
      </div>
      {createMutation.data && !createMutation.data.ok && (
        <ErrorMessage message={createMutation.data.message} />
      )}
    </form>
  );
}
