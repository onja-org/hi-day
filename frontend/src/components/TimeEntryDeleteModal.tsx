"use client";

import { useState } from "react";
import { UserIcon } from "@phosphor-icons/react";
import { useDeleteTimeEntry } from "@/hooks/useDeleteTimeEntry";
import { formatClockTimeWithSeconds } from "@/lib/formatClockTimeWithSeconds";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { Modal } from "./Modal";
import { ProjectAvatar } from "./ProjectAvatar";
import { Spinner } from "./Spinner";

type TimeEntryDeleteModalProps = {
  organisationId: string;
  entry: TimeEntryListItem;
  onClose: () => void;
};

/**
 * Confirms one deletion by laying out exactly what is about to go — whose
 * hours, which project, the span to the second — then asking why.
 *
 * The reason is required here though optional at the API (batch delete has
 * nowhere to ask per entry). A deleted row leaves nothing but its audit
 * entry, so this is the only part of that record a human wrote.
 */
export function TimeEntryDeleteModal({
  organisationId,
  entry,
  onClose,
}: TimeEntryDeleteModalProps) {
  const [reason, setReason] = useState("");
  const deleteMutation = useDeleteTimeEntry(organisationId, entry.id, onClose);
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

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
                Project
              </span>
              <span className="flex items-center gap-2 text-slate-900">
                <ProjectAvatar
                  name={entry.projectName}
                  colour={entry.projectColour}
                />
                {entry.projectName}
              </span>
            </div>
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

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
            Reason*
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={500}
            required
            placeholder="Why are you deleting this time entry? (ex: Forgot to stop timer)"
            className="w-full rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-input-border px-4 h-11 text-sm font-medium text-slate-900 transition-colors duration-150 hover:bg-cream"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={trimmedReason === "" || deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(trimmedReason)}
            className="flex cursor-pointer items-center gap-2 rounded-md bg-error px-4 h-11 text-sm font-medium text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:bg-error/40"
          >
            {deleteMutation.isPending && <Spinner />}
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}
