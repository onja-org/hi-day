"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CURRENT_ORGANISATION_QUERY_KEY } from "@/hooks/useCurrentOrganisation";
import { cancelOrganisationDeletion } from "@/lib/cancelOrganisationDeletion";
import type { OrganisationProfile } from "@/types/organisation";
import { DeleteOrganisationModal } from "./DeleteOrganisationModal";
import { Spinner } from "./Spinner";

type SuspendedOwnerActionsProps = {
  organisation: OrganisationProfile;
};

/** The owner's two ways out of a suspension: restore it, or end the recovery window now. */
export function SuspendedOwnerActions({
  organisation,
}: SuspendedOwnerActionsProps) {
  const queryClient = useQueryClient();
  const [isPermanentModalOpen, setIsPermanentModalOpen] = useState(false);

  const restoreMutation = useMutation({
    mutationFn: () => cancelOrganisationDeletion(organisation.id),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: CURRENT_ORGANISATION_QUERY_KEY,
        });
      }
    },
  });

  return (
    <>
      <p className="text-slate-900">
        As the owner you can restore everything until then, or delete it
        permanently now.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => restoreMutation.mutate()}
          disabled={restoreMutation.isPending}
          className="flex w-fit cursor-pointer items-center gap-2 rounded-md bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {restoreMutation.isPending && <Spinner />}
          Restore organisation
        </button>
        <button
          type="button"
          onClick={() => setIsPermanentModalOpen(true)}
          className="w-fit cursor-pointer rounded-md bg-error px-4 h-11 text-white transition-colors duration-150 hover:bg-error/90"
        >
          Permanently delete now
        </button>
      </div>

      {isPermanentModalOpen && (
        <DeleteOrganisationModal
          organisation={organisation}
          permanentOnly
          onClose={() => setIsPermanentModalOpen(false)}
        />
      )}
    </>
  );
}
