"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import {
  SUMMARY_EMAIL_PREFERENCES_QUERY_KEY,
  useSummaryEmailPreferences,
} from "@/hooks/useSummaryEmailPreferences";
import { SUMMARY_EMAIL_LABELS } from "@/lib/summaryEmailLabels";
import { updateSummaryEmailPreference } from "@/lib/updateSummaryEmailPreference";
import type {
  SummaryEmailKind,
  SummaryEmailPreference,
} from "@/types/summaryEmails";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { Switch } from "./Switch";

/** Your own summary emails for the organisation you're signed in to: each
 * one your admin's settings send you can be switched off here. */
export function SummaryEmailsSection() {
  const organisationQuery = useCurrentOrganisation();
  const organisation = organisationQuery.data;
  const organisationId = organisation ? String(organisation.id) : undefined;
  const preferencesQuery = useSummaryEmailPreferences(organisationId);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: { kind: SummaryEmailKind; enabled: boolean }) =>
      updateSummaryEmailPreference(organisationId!, input.kind, input.enabled),
    meta: { inlineErrors: true },
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData<SummaryEmailPreference[]>(
        SUMMARY_EMAIL_PREFERENCES_QUERY_KEY(organisationId!),
        result.preferences,
      );
    },
  });

  const preferences = preferencesQuery.data ?? [];
  const saveError =
    mutation.data && !mutation.data.ok ? mutation.data.message : null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-medium text-primary-dark">Summary emails</h2>
        <p className="text-sm text-slate-900/70">
          Recaps of tracked time
          {organisation ? ` at ${organisation.name}` : ""}, sent the morning
          after a day or week ends.
        </p>
      </header>

      {(organisationQuery.isLoading || preferencesQuery.isLoading) && (
        <p className="flex items-center gap-2 text-sm text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading…
        </p>
      )}

      {(organisationQuery.isError || preferencesQuery.isError) && (
        <ErrorMessage message="Could not load your summary emails." />
      )}
      {saveError && <ErrorMessage message={saveError} />}

      {preferencesQuery.isSuccess && preferences.length === 0 && (
        <p className="text-sm text-slate-900">
          No summary emails are sent to your role.
        </p>
      )}

      {preferences.length > 0 && (
        <ul className="flex flex-col divide-y divide-input-border">
          {preferences.map((preference) => (
            <li
              key={preference.kind}
              className="flex items-center justify-between gap-4 py-2"
            >
              <span className="flex flex-col">
                <span className="text-sm text-slate-900">
                  {SUMMARY_EMAIL_LABELS[preference.kind]}
                </span>
                {!preference.available && (
                  <span className="text-xs text-slate-900/60">
                    Turned off by your organisation
                  </span>
                )}
              </span>
              <Switch
                label={SUMMARY_EMAIL_LABELS[preference.kind]}
                checked={preference.enabled}
                disabled={!preference.available || mutation.isPending}
                onCheckedChange={(enabled) =>
                  mutation.mutate({ kind: preference.kind, enabled })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
