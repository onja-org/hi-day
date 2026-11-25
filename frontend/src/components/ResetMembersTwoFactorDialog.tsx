"use client";

import { useMutation } from "@tanstack/react-query";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { resetMembersTwoFactor } from "@/lib/resetMembersTwoFactor";
import { ConfirmDialog } from "./ConfirmDialog";

type ResetMembersTwoFactorDialogProps = {
  organisationId: string;
  membershipIds: string[];
  /** e.g. "12 members". */
  memberLabel: string;
  onClose: () => void;
};

/** The batch form of `ResetTwoFactorDialog`. The result toast says how many
 * were reset vs skipped. The backend still records each one in the audit
 * log; the dialog doesn't say so, as admins have no audit-log page. */
export function ResetMembersTwoFactorDialog({
  organisationId,
  membershipIds,
  memberLabel,
  onClose,
}: ResetMembersTwoFactorDialogProps) {
  const invalidate = useInvalidateTeams(organisationId);
  const mutation = useMutation({
    mutationFn: () => resetMembersTwoFactor(organisationId, membershipIds),
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
        "Two-step login will be turned off for everyone listed who has it on. Use this only if many people can't get their codes at once.",
        "Until each person turns it back on, they'll log in with just their password. Their recovery codes and remembered browsers stop working.",
        "Your own two-step login stays on.",
      ].join("\n\n")}
      confirmLabel={`Reset ${memberLabel}`}
      isDangerous
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  );
}
