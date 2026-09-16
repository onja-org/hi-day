"use client";

import { useSearchParams } from "next/navigation";
import { getDayRangeDateString } from "@/lib/getDayRange";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useNotesForDay } from "@/hooks/useNotesForDay";
import { ActivityFilterToolbar } from "./ActivityFilterToolbar";
import { ErrorMessage } from "./ErrorMessage";
import { NoteComposer } from "./NoteComposer";
import { NoteDayList } from "./NoteDayList";
import { Spinner } from "./Spinner";

type NotesPageContentProps = {
  organisationId: string;
};

/** The Activities page's "Notes" tab: per-day (optionally per-project)
 * notes, replacing the old freeform, day-agnostic post feed. */
export function NotesPageContent({ organisationId }: NotesPageContentProps) {
  const searchParams = useSearchParams();
  const organisationQuery = useCurrentOrganisation();
  const canViewOthers =
    organisationQuery.data?.role === "admin" || organisationQuery.data?.role === "manager";

  const dayOffset = Number(searchParams.get("day") ?? "0") || 0;
  const membershipId = searchParams.get("membershipId") ?? undefined;
  const isOwnNotes = !membershipId;
  const date = getDayRangeDateString(new Date(), dayOffset);

  const notesQuery = useNotesForDay(organisationId, { date, membershipId });

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

      {notesQuery.isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading notes…
        </p>
      )}

      {notesQuery.isError && (
        <ErrorMessage
          message={
            notesQuery.error instanceof Error
              ? notesQuery.error.message
              : "Could not load notes."
          }
        />
      )}

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
