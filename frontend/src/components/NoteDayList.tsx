"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "@phosphor-icons/react";
import { deleteNote } from "@/lib/deleteNote";
import type { Note } from "@/types/note";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectBadgeOrUntracked } from "./ProjectBadgeOrUntracked";
import { Spinner } from "./Spinner";

type NoteDayListProps = {
  organisationId: string;
  notes: Note[];
  /** Only the caller's own notes can be deleted — omit for a read-only
   * (viewing someone else's) list. */
  canDelete: boolean;
};

export function NoteDayList({ organisationId, notes, canDelete }: NoteDayListProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteNote(organisationId, noteId),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: ["notes", organisationId] });
      }
    },
  });

  if (notes.length === 0) {
    return <p className="text-slate-900">No notes for this day yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {notes.map((note) => (
        <li
          key={note.id}
          className="flex items-start justify-between gap-3 rounded-md border border-input-border p-3"
        >
          <div className="flex flex-col gap-1">
            {note.projectId && (
              <ProjectBadgeOrUntracked organisationId={organisationId} projectId={note.projectId} />
            )}
            <p className="text-slate-900">{note.content}</p>
            <p className="text-sm text-slate-900/70">
              {new Date(note.createdAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={() => deleteMutation.mutate(note.id)}
              disabled={deleteMutation.isPending}
              aria-label="Delete note"
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-input-border px-3 py-1.5 text-sm text-slate-900 transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TrashIcon size={16} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
      {deleteMutation.data && !deleteMutation.data.ok && (
        <ErrorMessage message={deleteMutation.data.message} />
      )}
      {deleteMutation.isPending && (
        <li className="flex items-center gap-2 text-sm text-slate-900/70">
          <Spinner /> Deleting…
        </li>
      )}
    </ul>
  );
}
