"use client";

import { useState } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { formatClockTime } from "@/lib/formatClockTime";
import { formatElapsed } from "@/lib/formatElapsed";
import {
  entryEditBlockedReason,
  entrySplitBlockedReason,
} from "@/lib/entryEditBlockedReason";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { entryProjectColour, entryTitle } from "@/lib/entryProjectDisplay";
import { Modal } from "./Modal";
import { ProjectAvatar } from "./ProjectAvatar";
import { TimeEntryDeleteModal } from "./TimeEntryDeleteModal";
import { TimeEntryFormModal } from "./TimeEntryFormModal";
import { TimeEntrySplitModal } from "./TimeEntrySplitModal";

type TimeEntryDetailModalProps = {
  organisationId: string;
  entry: TimeEntryListItem;
  onClose: () => void;
};

type OpenAction = "edit" | "split" | "delete" | null;

/**
 * What a calendar block opens: who and what the entry is, when it ran, and
 * the same three actions the table's row menu offers. The calendar shows no
 * per-block controls of its own, so this card is where they live.
 */
export function TimeEntryDetailModal({
  organisationId,
  entry,
  onClose,
}: TimeEntryDetailModalProps) {
  const [action, setAction] = useState<OpenAction>(null);
  const organisationQuery = useCurrentOrganisation();
  const editBlocked = entryEditBlockedReason(entry);
  const splitBlocked = entrySplitBlockedReason(entry);

  if (action === "edit") {
    return (
      <TimeEntryFormModal
        organisationId={organisationId}
        entry={entry}
        onClose={onClose}
      />
    );
  }

  if (action === "split") {
    return (
      <TimeEntrySplitModal
        organisationId={organisationId}
        entry={entry}
        onClose={onClose}
      />
    );
  }

  if (action === "delete") {
    return (
      <TimeEntryDeleteModal
        organisationId={organisationId}
        entry={entry}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal title={entryTitle(entry)} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <span className="flex items-center gap-3">
            <ProjectAvatar name={entryTitle(entry)} colour={entryProjectColour(entry)} />
            <span className="flex flex-col">
              <span className="text-sm text-slate-900">
                {organisationQuery.data?.name ?? ""}
              </span>
              <span className="text-xs text-slate-900/60">
                {entry.taskName ?? "No task"}
              </span>
            </span>
          </span>
          <span className="flex flex-col text-right">
            <span className="text-sm text-slate-900">
              {formatClockTime(entry.startedAt)} –{" "}
              {entry.endedAt ? formatClockTime(entry.endedAt) : "now"}
            </span>
            <span className="text-xs text-slate-900/60">
              {new Date(entry.startedAt).toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </span>
        </div>

        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-900">
          <span>
            Duration:{" "}
            <span className="tabular-nums">
              {entry.durationSeconds === null
                ? "—"
                : formatElapsed(entry.durationSeconds * 1000)}
            </span>
          </span>
          <span className="rounded-full bg-cream px-2 py-0.5 text-xs text-primary-dark">
            {entry.source === "manual" ? "100% manual" : "0% manual"}
          </span>
        </p>

        {(entry.canEdit || entry.canDelete) && (
          <>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!entry.canDelete}
                title={
                  entry.canDelete ? undefined : "You can only delete your own entries."
                }
                onClick={() => setAction("delete")}
                className="cursor-pointer rounded-brand-sm bg-error px-4 h-11 text-sm font-bold text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:bg-error/40 border-2 border-ink"
              >
                Delete
              </button>
              {/* Disabled rather than hidden, with the reason spelled out
                  below — a control that comes and goes reads as broken. */}
              <button
                type="button"
                disabled={editBlocked !== undefined}
                title={editBlocked}
                onClick={() => setAction("edit")}
                className="cursor-pointer rounded-brand-sm bg-primary px-4 h-11 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/40 border-2 border-ink"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={splitBlocked !== undefined}
                title={splitBlocked}
                onClick={() => setAction("split")}
                className="cursor-pointer rounded-brand-sm border-2 border-ink px-4 h-11 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:border-input-border disabled:text-slate-900/40 disabled:hover:border-input-border disabled:hover:text-slate-900/40"
              >
                Split
              </button>
            </div>
            {(editBlocked ?? splitBlocked) && (
              <p className="text-xs text-slate-900/60">
                {editBlocked ?? splitBlocked}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
