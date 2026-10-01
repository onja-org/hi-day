"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CURRENT_ORGANISATION_QUERY_KEY } from "@/hooks/useCurrentOrganisation";
import { confirmOrganisationDeletion } from "@/lib/confirmOrganisationDeletion";
import type { OrganisationProfile } from "@/types/organisation";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type ConfirmOrganisationDeletionPromptProps = {
  organisation: OrganisationProfile;
  token: string;
};

/**
 * Landing spot for the emailed link. Deliberately needs a click: opening a
 * link (or a mail client prefetching it) must never delete anything.
 * Closing it just drops the token from the URL.
 */
export function ConfirmOrganisationDeletionPrompt({
  organisation,
  token,
}: ConfirmOrganisationDeletionPromptProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const settingsPath = `/organisations/${organisation.id}/settings`;

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrganisationDeletion(organisation.id, token),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: CURRENT_ORGANISATION_QUERY_KEY,
        });
        router.replace(settingsPath);
      }
    },
  });
  const failure =
    confirmMutation.data && !confirmMutation.data.ok
      ? confirmMutation.data.message
      : null;

  return (
    <Modal
      title={`Confirm deleting ${organisation.name}`}
      onClose={() => router.replace(settingsPath)}
    >
      {organisation.isOwner ? (
        <>
          <p className="text-slate-900">
            You asked to delete this organisation. Confirming applies it right
            away.
          </p>
          {failure && <ErrorMessage message={failure} />}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.replace(settingsPath)}
              className="cursor-pointer rounded-md border border-input-border px-4 h-11 text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-error px-4 h-11 text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmMutation.isPending && <Spinner />}
              Confirm deletion
            </button>
          </div>
        </>
      ) : (
        <ErrorMessage message="Only the organisation owner can confirm deleting the account." />
      )}
    </Modal>
  );
}
