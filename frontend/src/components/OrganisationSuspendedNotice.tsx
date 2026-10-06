"use client";

import { useSearchParams } from "next/navigation";
import { formatShortDate } from "@/lib/formatShortDate";
import { getDeletionState } from "@/lib/getDeletionState";
import type { OrganisationProfile } from "@/types/organisation";
import { ConfirmOrganisationDeletionPrompt } from "./ConfirmOrganisationDeletionPrompt";
import { SuspendedOwnerActions } from "./SuspendedOwnerActions";

type OrganisationSuspendedNoticeProps = {
  organisation: OrganisationProfile;
};

/**
 * Replaces every page of a suspended organisation; the backend refuses its
 * data anyway. It also hosts the emailed confirmation link for a permanent
 * deletion requested while suspended, since the settings page that normally
 * shows it is hidden behind this notice.
 */
export function OrganisationSuspendedNotice({
  organisation,
}: OrganisationSuspendedNoticeProps) {
  const confirmDeletionToken = useSearchParams().get("confirmDeletion");

  if (getDeletionState(organisation) === "purging") {
    return (
      <section className="flex max-w-xl flex-col gap-3">
        <h1 className="text-2xl font-semibold text-primary-dark">
          {organisation.name} is being permanently deleted
        </h1>
        <p className="text-slate-900">
          This can no longer be stopped or restored. Nobody can access it, and
          desktop agents have stopped tracking.
        </p>
      </section>
    );
  }

  return (
    <section className="flex max-w-xl flex-col gap-3">
      {confirmDeletionToken && (
        <ConfirmOrganisationDeletionPrompt
          organisation={organisation}
          token={confirmDeletionToken}
        />
      )}
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
        <SuspendedOwnerActions organisation={organisation} />
      ) : (
        <p className="text-slate-900">
          Contact the organisation owner if this is a mistake.
        </p>
      )}
    </section>
  );
}
