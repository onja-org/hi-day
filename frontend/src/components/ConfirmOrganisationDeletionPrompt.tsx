"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CURRENT_ORGANISATION_QUERY_KEY } from "@/hooks/useCurrentOrganisation";
import { useOrganisationDeletionStatus } from "@/hooks/useOrganisationDeletionStatus";
import { confirmOrganisationDeletion } from "@/lib/confirmOrganisationDeletion";
import type { OrganisationProfile } from "@/types/organisation";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { OwnerAccountWarning } from "./OwnerAccountWarning";
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
  // Read so this last step can say plainly when it's irreversible.
  const statusQuery = useOrganisationDeletionStatus(
    organisation.id,
    organisation.isOwner,
  );
  const status = statusQuery.data;
  const isPermanent = status?.pendingRequestMode === "permanent";

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrganisationDeletion(organisation.id, token),
    onSuccess: (result) => {
      if (!result.ok) return;
      // A permanent deletion that erases the owner's account has already
      // ended this session server-side. A full navigation (not the router)
      // drops the client cache, so "back" can't reopen a dead dashboard.
      if (result.signedOut) {
        window.location.replace("/organisation-deleted");
        return;
      }
      // Otherwise the current organisation may now be a different one, which
      // OrganisationGuard redirects to.
      queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANISATION_QUERY_KEY,
      });
      router.replace(settingsPath);
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
          {isPermanent ? (
            <div className="flex flex-col gap-1">
              <p className="text-slate-900">
                You asked to <strong>permanently</strong> delete this
                organisation. Confirming erases it within minutes, with no
                recovery window. This cannot be undone.
              </p>
              <OwnerAccountWarning
                ownerKeepsAccount={status?.ownerKeepsAccount ?? null}
              />
            </div>
          ) : (
            <p className="text-slate-900">
              You asked to delete this organisation. Confirming applies it
              right away.
            </p>
          )}
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
              disabled={confirmMutation.isPending || statusQuery.isLoading}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-error px-4 h-11 text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmMutation.isPending && <Spinner />}
              {isPermanent ? "Delete permanently" : "Confirm deletion"}
            </button>
          </div>
        </>
      ) : (
        <ErrorMessage message="Only the organisation owner can confirm deleting the account." />
      )}
    </Modal>
  );
}
