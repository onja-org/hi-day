"use client";

import type { TimeEntryListItem } from "@/types/timeEntry";
import { Modal } from "./Modal";
import { TimeEntryForm } from "./TimeEntryForm";

type TimeEntryFormModalProps = {
  organisationId: string;
  entry?: TimeEntryListItem;
  /** Whose timesheet a new entry lands on. Omitted, it's the caller's own. */
  forMembershipId?: string;
  /** Entries already on screen, so a clash is flagged while the times are
   * being typed rather than on save. */
  existingEntries?: TimeEntryListItem[];
  onClose: () => void;
};

export function TimeEntryFormModal({
  organisationId,
  entry,
  forMembershipId,
  existingEntries,
  onClose,
}: TimeEntryFormModalProps) {
  return (
    <Modal title={entry ? "Edit time entry" : "Add time"} onClose={onClose}>
      {entry ? (
        <TimeEntryForm
          organisationId={organisationId}
          mode="edit"
          entry={entry}
          existingEntries={existingEntries}
          onSaved={onClose}
        />
      ) : (
        <TimeEntryForm
          organisationId={organisationId}
          mode="create"
          forMembershipId={forMembershipId}
          existingEntries={existingEntries}
          onSaved={onClose}
        />
      )}
    </Modal>
  );
}
