"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CURRENT_ORGANISATION_QUERY_KEY,
  useCurrentOrganisation,
} from "@/hooks/useCurrentOrganisation";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type {
  OrganisationProfile,
  UpdateOrganisationInput,
} from "@/types/organisation";
import { ErrorMessage } from "./ErrorMessage";
import { SettingsSaveBar } from "./SettingsSaveBar";
import { useSettingsDirty } from "./SettingsDirtyProvider";
import { Spinner } from "./Spinner";

type SettingsPanelProps = {
  /** This section's slice of the update — the backend merges, so a section
   * only ever sends its own fields. */
  buildInput: (formData: FormData) => UpdateOrganisationInput;
  children: (organisation: OrganisationProfile) => ReactNode;
};

/** One Settings section: loads the organisation, saves its own fields. */
export function SettingsPanel({ buildInput, children }: SettingsPanelProps) {
  const organisationQuery = useCurrentOrganisation();
  const queryClient = useQueryClient();
  const { setDirty } = useSettingsDirty();
  const [isDirty, setIsDirty] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);

  useEffect(() => {
    setDirty(isDirty);
    return () => setDirty(false);
  }, [isDirty, setDirty]);

  const organisation = organisationQuery.data;
  const updateMutation = useMutation({
    mutationFn: (input: UpdateOrganisationInput) =>
      updateOrganisation(organisation!.id, input),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        CURRENT_ORGANISATION_QUERY_KEY,
        result.organisation,
      );
      setIsDirty(false);
    },
  });

  if (organisationQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 py-8 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading settings…
      </p>
    );
  }

  if (organisationQuery.isError || !organisation) {
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not load these settings."
        }
      />
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateMutation.mutate(buildInput(new FormData(event.currentTarget)));
  }

  return (
    <form
      // Remounts the fields so Discard returns them to what is stored.
      key={`${JSON.stringify(organisation)}::${resetNonce}`}
      onSubmit={handleSubmit}
      onChange={() => setIsDirty(true)}
      className="flex flex-col gap-9 py-6"
    >
      {children(organisation)}

      {updateMutation.data && !updateMutation.data.ok && (
        <ErrorMessage message={updateMutation.data.message} />
      )}

      <SettingsSaveBar
        isDirty={isDirty}
        isPending={updateMutation.isPending}
        onDiscard={() => {
          setResetNonce((nonce) => nonce + 1);
          setIsDirty(false);
        }}
      />
    </form>
  );
}
