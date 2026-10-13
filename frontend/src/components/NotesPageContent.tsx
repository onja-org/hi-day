"use client";

import { useActivityDayFilters } from "@/hooks/useActivityDayFilters";
import { useNotesForDay } from "@/hooks/useNotesForDay";
import { ActivityFilterToolbar } from "./ActivityFilterToolbar";
import { ActivityQueryStatus } from "./ActivityQueryStatus";
import { NoteComposer } from "./NoteComposer";
import { NoteDayList } from "./NoteDayList";

type NotesPageContentProps = {
  organisationId: string;
};

/** The Activities page's "Notes" tab: per-day (optionally per-project)
 * notes, replacing the old freeform, day-agnostic post feed. */
export function NotesPageContent({ organisationId }: NotesPageContentProps) {
  const { date, membershipId, projectId, canViewOthers } = useActivityDayFilters();
  const isOwnNotes = !membershipId;

  const notesQuery = useNotesForDay(organisationId, { date, membershipId, projectId });

  return (
    <div className="flex flex-col gap-4">
      <ActivityFilterToolbar organisationId={organisationId} canViewOthers={canViewOthers} />

      {isOwnNotes && (
        <NoteComposer
          organisationId={organisationId}
          noteDate={date}
          onCreated={() => void notesQuery.refetch()}
        />
      )}

      <ActivityQueryStatus
        isLoading={notesQuery.isLoading}
        isError={notesQuery.isError}
        error={notesQuery.error}
        loadingLabel="Loading notes…"
        errorFallback="Could not load notes."
      />

      {notesQuery.data && (
        <NoteDayList
          organisationId={organisationId}
          notes={notesQuery.data}
          canDelete={isOwnNotes}
        />
      )}
    </div>
  );
}
