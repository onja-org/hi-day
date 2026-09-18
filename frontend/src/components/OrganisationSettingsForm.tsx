"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { FormEvent } from "react";
import {
  CURRENT_ORGANISATION_QUERY_KEY,
  useCurrentOrganisation,
} from "@/hooks/useCurrentOrganisation";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type { IdleHandling, UpdateOrganisationInput } from "@/types/organisation";
import { CaptureSettingsFields } from "./CaptureSettingsFields";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { WorkingHoursField } from "./WorkingHoursField";

const CLOSE_DELAY_MS = 900;

type OrganisationSettingsFormProps = {
  onSuccess?: () => void;
};

export function OrganisationSettingsForm({
  onSuccess,
}: OrganisationSettingsFormProps) {
  const queryClient = useQueryClient();
  const organisationQuery = useCurrentOrganisation();

  const updateMutation = useMutation({
    mutationFn: (input: UpdateOrganisationInput) =>
      updateOrganisation(organisationQuery.data!.id, input),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(
          CURRENT_ORGANISATION_QUERY_KEY,
          result.organisation,
        );
      }
    },
  });

  useEffect(() => {
    if (!updateMutation.data?.ok) return;

    const timeout = setTimeout(() => onSuccess?.(), CLOSE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [updateMutation.data, onSuccess]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const website = formData.get("website");
    const idleThresholdMinutes = Number(formData.get("idleThresholdMinutes"));
    const workingHoursPerDay = Number(formData.get("workingHoursPerDay"));
    const screenshotFrequencyMinutes = Number(
      formData.get("screenshotFrequencyMinutes"),
    );
    const screenshotRetentionDays = Number(
      formData.get("screenshotRetentionDays"),
    );

    updateMutation.mutate({
      name: String(formData.get("name") ?? ""),
      address: String(formData.get("address") ?? ""),
      website: website ? String(website) : undefined,
      idleHandling: formData.get("idleHandling") as IdleHandling,
      idleThresholdMinutes: Number.isFinite(idleThresholdMinutes)
        ? idleThresholdMinutes
        : undefined,
      workingHoursPerDay: Number.isFinite(workingHoursPerDay)
        ? workingHoursPerDay
        : undefined,
      windowTrackingEnabled: formData.get("windowTrackingEnabled") === "on",
      screenshotsEnabled: formData.get("screenshotsEnabled") === "on",
      activityTrackingEnabled:
        formData.get("activityTrackingEnabled") === "on",
      screenshotFrequencySeconds: Number.isFinite(screenshotFrequencyMinutes)
        ? screenshotFrequencyMinutes * 60
        : undefined,
      screenshotRetentionDays: Number.isFinite(screenshotRetentionDays)
        ? screenshotRetentionDays
        : undefined,
    });
  }

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
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-4xl flex-col gap-6"
    >
      <label className="flex flex-col gap-1.5">
        Company name
        <input
          name="name"
          type="text"
          defaultValue={organisation.name}
          required
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Address
        <input
          name="address"
          type="text"
          defaultValue={organisation.address ?? ""}
          required
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Website (optional)
        <input
          name="website"
          type="text"
          defaultValue={organisation.website ?? ""}
          placeholder="https://example.com"
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <WorkingHoursField organisation={organisation} />

      <div className="flex flex-col gap-5 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5">
          Idle handling
          <select
            name="idleHandling"
            defaultValue={organisation.idleHandling}
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="off">Off — never react to idle time</option>
            <option value="flag">
              Flag — ask the person to keep or discard it
            </option>
            <option value="auto_subtract">
              Auto-subtract — end the timer automatically
            </option>
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          Idle threshold (minutes)
          <input
            name="idleThresholdMinutes"
            type="number"
            min="1"
            step="1"
            defaultValue={organisation.idleThresholdMinutes}
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>

      <CaptureSettingsFields organisation={organisation} />

      <button
        type="submit"
        disabled={updateMutation.isPending}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
      >
        {updateMutation.isPending && <Spinner />}
        {updateMutation.isPending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
