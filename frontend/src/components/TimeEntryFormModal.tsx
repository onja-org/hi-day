"use client";

import type { TimeEntryListItem } from "@/types/timeEntry";
import { Modal } from "./Modal";
import { TimeEntryForm } from "./TimeEntryForm";

type TimeEntryFormModalProps = {
  organisationId: string;
  entry?: TimeEntryListItem;
  onClose: () => void;
};

export function TimeEntryFormModal({
  organisationId,
  entry,
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
        <TimeEntryForm organisationId={organisationId} mode="create" onSaved={onClose} />
      )}
    </Modal>
  );
}
