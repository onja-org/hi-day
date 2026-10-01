"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CURRENT_ORGANISATION_QUERY_KEY } from "@/hooks/useCurrentOrganisation";
import { cancelOrganisationDeletion } from "@/lib/cancelOrganisationDeletion";
import { formatShortDate } from "@/lib/formatShortDate";
import type { OrganisationProfile } from "@/types/organisation";
import { Spinner } from "./Spinner";

type OrganisationSuspendedNoticeProps = {
  organisation: OrganisationProfile;
};

/** Replaces every page of a suspended organisation; the backend refuses its data anyway. */
export function OrganisationSuspendedNotice({
  organisation,
}: OrganisationSuspendedNoticeProps) {
  const queryClient = useQueryClient();

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
    <section className="flex max-w-xl flex-col gap-3">
      <h1 className="text-2xl font-semibold text-primary-dark">
        {organisation.name} is suspended
      </h1>
      <p className="text-slate-900">
        This organisation was closed and is scheduled to be permanently deleted
        {organisation.purgeAt && (
          <> on <strong>{formatShortDate(organisation.purgeAt)}</strong></>
        )}
        . Nobody can access it, and desktop agents have stopped tracking.
      </p>
      {organisation.isOwner ? (
        <>
          <p className="text-slate-900">
            As the owner you can restore everything until then.
          </p>
          <button
            type="button"
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending}
            className="flex w-fit cursor-pointer items-center gap-2 rounded-md bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {restoreMutation.isPending && <Spinner />}
            Restore organisation
          </button>
        </>
      ) : (
        <p className="text-slate-900">
          Contact the organisation owner if this is a mistake.
        </p>
      )}
    </section>
  );
}
