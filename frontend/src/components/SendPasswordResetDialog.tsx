"use client";

import { useMutation } from "@tanstack/react-query";
import { sendPasswordResets } from "@/lib/sendPasswordResets";
import { ConfirmDialog } from "./ConfirmDialog";

type SendPasswordResetDialogProps = {
  organisationId: string;
  membershipIds: string[];
  /** Who's getting the email, e.g. "Ada Lovelace" or "all 12 members". */
  recipientLabel: string;
  onClose: () => void;
};

/** Confirms, then emails the standard reset link — the admin never sees or
 * sets a password. The result toast says how many were sent vs skipped. */
export function SendPasswordResetDialog({
  organisationId,
  membershipIds,
  recipientLabel,
  onClose,
}: SendPasswordResetDialogProps) {
  const mutation = useMutation({
    mutationFn: () => sendPasswordResets(organisationId, membershipIds),
    onSuccess: (result) => {
      if (result.ok) onClose();
    },
  });

  return (
    <ConfirmDialog
      title="Send password reset"
      message={`Email ${recipientLabel} a link to choose a new password? Their current password keeps working until they use the link. You won't see or set the new password.`}
      confirmLabel="Send reset email"
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  );
}
