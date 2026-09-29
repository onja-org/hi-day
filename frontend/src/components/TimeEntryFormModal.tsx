"use client";

import type { TimeEntryListItem } from "@/types/timeEntry";
import { Modal } from "./Modal";
import { TimeEntryForm } from "./TimeEntryForm";

type TimeEntryFormModalProps = {
  organisationId: string;
  entry?: TimeEntryListItem;
  /** Whose timesheet a new entry lands on. Omitted, it's the caller's own. */
  forMembershipId?: string;
  onClose: () => void;
};

export function TimeEntryFormModal({
  organisationId,
  entry,
  forMembershipId,
  onClose,
}: TimeEntryFormModalProps) {
  return (
    <Modal title={entry ? "Edit time entry" : "Add time"} onClose={onClose}>
      {entry ? (
        <TimeEntryForm
          organisationId={organisationId}
          mode="edit"
          entry={entry}
          onSaved={onClose}
        />
      ) : (
        <TimeEntryForm
          organisationId={organisationId}
          mode="create"
          forMembershipId={forMembershipId}
          onSaved={onClose}
        />
      )}
    </Modal>
  );
}
