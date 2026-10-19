"use client";

import { useState } from "react";
import { UserIcon } from "@phosphor-icons/react";
import { useDeleteTimeEntry } from "@/hooks/useDeleteTimeEntry";
import { useRequireTimeEntryReason } from "@/hooks/useRequireTimeEntryReason";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { formatClockTimeWithSeconds } from "@/lib/formatClockTimeWithSeconds";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { entryProjectColour, entryTitle } from "@/lib/entryProjectDisplay";
import { Modal } from "./Modal";
import { ProjectAvatar } from "./ProjectAvatar";
import { Spinner } from "./Spinner";
import { TimeEntryReasonField } from "./TimeEntryReasonField";

type TimeEntryDeleteModalProps = {
  organisationId: string;
  entry: TimeEntryListItem;
  onClose: () => void;
};

/**
 * Confirms one deletion by laying out exactly what is about to go — whose
 * hours, which project, the span to the second — then asking why.
 *
 * Whether the reason is compulsory is the organisation's Require reason
 * setting, which the API enforces too. A deleted row leaves nothing but
 * its audit entry, so this is the only part of that record a human wrote.
 */
export function TimeEntryDeleteModal({
  organisationId,
  entry,
  onClose,
}: TimeEntryDeleteModalProps) {
  const projectsEnabled = useProjectsEnabled();
  const [reason, setReason] = useState("");
  const deleteMutation = useDeleteTimeEntry(organisationId, entry.id, onClose);
  const isReasonRequired = useRequireTimeEntryReason();
  const trimmedReason = reason.trim();

  const day = new Date(entry.startedAt).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Modal title="Delete time" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-md border border-input-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
                Member
              </span>
              <span className="flex items-center gap-2 text-slate-900">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <UserIcon size={16} aria-hidden="true" />
                </span>
                {entry.memberName ?? entry.memberEmail ?? "Unknown member"}
              </span>
            </div>

            {projectsEnabled && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
                  Project
                </span>
                <span className="flex items-center gap-2 text-slate-900">
                  <ProjectAvatar
                    name={entryTitle(entry)}
                    colour={entryProjectColour(entry)}
                  />
                  {entryTitle(entry)}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
              Time span
            </span>
            <span className="text-slate-900">
              {day} from {formatClockTimeWithSeconds(entry.startedAt)} to{" "}
              {entry.endedAt
                ? formatClockTimeWithSeconds(entry.endedAt)
                : "not stopped yet"}
            </span>
          </div>
        </div>

        <TimeEntryReasonField
          organisationId={organisationId}
          value={reason}
          onChange={setReason}
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-brand-sm border-2 border-ink px-4 h-11 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:bg-cream"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              (isReasonRequired && trimmedReason === "") ||
              deleteMutation.isPending
            }
            onClick={() => deleteMutation.mutate(trimmedReason || undefined)}
            className="flex cursor-pointer items-center gap-2 rounded-brand-sm bg-error px-4 h-11 text-sm font-bold text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:bg-error/40 border-2 border-ink"
          >
            {deleteMutation.isPending && <Spinner />}
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}
