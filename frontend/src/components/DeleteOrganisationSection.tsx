"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CURRENT_ORGANISATION_QUERY_KEY } from "@/hooks/useCurrentOrganisation";
import { cancelOrganisationDeletion } from "@/lib/cancelOrganisationDeletion";
import { formatShortDate } from "@/lib/formatShortDate";
import { getDeletionState } from "@/lib/getDeletionState";
import type { OrganisationProfile } from "@/types/organisation";
import { DeleteOrganisationModal } from "./DeleteOrganisationModal";
import { SettingsSectionRow } from "./SettingsSectionRow";
import { Spinner } from "./Spinner";

type DeleteOrganisationSectionProps = {
  organisation: OrganisationProfile;
};

export function DeleteOrganisationSection({
  organisation,
}: DeleteOrganisationSectionProps) {
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState<"any" | "permanent" | null>(
    null,
  );
  const state = getDeletionState(organisation);

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrganisationDeletion(organisation.id),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: CURRENT_ORGANISATION_QUERY_KEY,
        });
      }
    },
  });

  if (!organisation.isOwner) return null;

  return (
    <div className="mt-9 max-w-6xl">
      <SettingsSectionRow
        title="Delete organisation"
        description="Close this account and erase all of its data. Only the owner can do this."
      >
        <div className="flex flex-col items-end gap-4 bg-white">
          {state === "scheduled" && organisation.deletionScheduledFor && (
            <>
              <p className="text-slate-900">
                Scheduled for deletion on{" "}
                <strong>
                  {formatShortDate(organisation.deletionScheduledFor)}
                </strong>
                . You can keep using the account until then.
              </p>
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="flex w-fit cursor-pointer items-center gap-2 rounded-brand-sm border-2 border-ink px-4 h-11 text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 font-semibold"
                >
                  {cancelMutation.isPending && <Spinner />}
                  Cancel scheduled deletion
                </button>
                <button
                  type="button"
                  onClick={() => setOpenModal("permanent")}
                  className="w-fit cursor-pointer rounded-brand-sm bg-error px-4 h-11 text-white transition-colors duration-150 hover:bg-error/90 border-2 border-ink font-bold"
                >
                  Delete permanently now
                </button>
              </div>
            </>
          )}
          {state === "active" && (
            <button
              type="button"
              onClick={() => setOpenModal("any")}
              className="w-fit cursor-pointer rounded-brand-sm bg-error px-4 h-11 text-white transition-colors duration-150 hover:bg-error/90 border-2 border-ink font-bold"
            >
              Delete organisation
            </button>
          )}
        </div>
      </SettingsSectionRow>

      {openModal && (
        <DeleteOrganisationModal
          organisation={organisation}
          permanentOnly={openModal === "permanent"}
          onClose={() => setOpenModal(null)}
        />
      )}
    </div>
  );
}
