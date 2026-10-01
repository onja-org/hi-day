"use client";

import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { ConfirmOrganisationDeletionPrompt } from "./ConfirmOrganisationDeletionPrompt";
import { DeleteOrganisationSection } from "./DeleteOrganisationSection";
import { OrganisationSettingsForm } from "./OrganisationSettingsForm";
import { RequireRole } from "./RequireRole";

type OrganisationSettingsPageContentProps = {
  /** From the emailed deletion-confirmation link's query string. */
  confirmDeletionToken?: string;
};

export function OrganisationSettingsPageContent({
  confirmDeletionToken,
}: OrganisationSettingsPageContentProps) {
  const organisation = useCurrentOrganisation().data;

  return (
    <RequireRole role="admin">
      {organisation && confirmDeletionToken && (
        <ConfirmOrganisationDeletionPrompt
          organisation={organisation}
          token={confirmDeletionToken}
        />
      )}
      <OrganisationSettingsForm />
      {organisation && <DeleteOrganisationSection organisation={organisation} />}
    </RequireRole>
  );
}
