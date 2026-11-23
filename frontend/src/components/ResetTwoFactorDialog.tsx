"use client";

import { useMutation } from "@tanstack/react-query";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { resetMemberTwoFactor } from "@/lib/resetMemberTwoFactor";
import { ConfirmDialog } from "./ConfirmDialog";

type ResetTwoFactorDialogProps = {
  organisationId: string;
  membershipId: string;
  /** e.g. "Ada Lovelace". */
  memberLabel: string;
  onClose: () => void;
};

/** For a member who lost both their phone and their recovery codes. The
 * backend records who did it in the audit log. */
export function ResetTwoFactorDialog({
  organisationId,
  membershipId,
  memberLabel,
  onClose,
}: ResetTwoFactorDialogProps) {
  const invalidate = useInvalidateTeams(organisationId);
  const mutation = useMutation({
    mutationFn: () => resetMemberTwoFactor(organisationId, membershipId),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onClose();
      }
    },
  });

  return (
    <ConfirmDialog
      title={`Reset two-step login for ${memberLabel}?`}
      message={[
        "Do this only if they've lost both their phone and their recovery codes, and you're sure it's really them asking.",
        "Until they turn it back on, they'll log in with just their password. Their recovery codes and remembered browsers stop working.",
      ].join("\n\n")}
      confirmLabel="Reset two-step login"
      isDangerous
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  );
}
