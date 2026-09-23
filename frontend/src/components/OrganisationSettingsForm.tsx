"use client";

import { useState } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { ErrorMessage } from "./ErrorMessage";
import { OrganisationSettingsFields } from "./OrganisationSettingsFields";
import { Spinner } from "./Spinner";

export function OrganisationSettingsForm() {
  const organisationQuery = useCurrentOrganisation();
  const [resetNonce, setResetNonce] = useState(0);

  if (organisationQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading organisation settings…
      </p>
    );
  }

  if (organisationQuery.isError || !organisationQuery.data) {
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not load organisation settings."
        }
      />
    );
  }

  const organisation = organisationQuery.data;

  return (
    <OrganisationSettingsFields
      // Remounts on every save (new organisation snapshot) and every Discard
      // (resetNonce bump) so uncontrolled inputs and child field state reset
      // to the last-saved values instead of drifting from them.
      key={`${JSON.stringify(organisation)}::${resetNonce}`}
      organisation={organisation}
      onDiscard={() => setResetNonce((n) => n + 1)}
    />
  );
}
