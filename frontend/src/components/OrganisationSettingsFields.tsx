"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CURRENT_ORGANISATION_QUERY_KEY } from "@/hooks/useCurrentOrganisation";
import { buildUpdateOrganisationInput } from "@/lib/buildUpdateOrganisationInput";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type {
  OrganisationProfile,
  UpdateOrganisationInput,
} from "@/types/organisation";
import { CaptureSettingsFields } from "./CaptureSettingsFields";
import { CompanyProfileFields } from "./CompanyProfileFields";
import { ErrorMessage } from "./ErrorMessage";
import { IdleTimeFields } from "./IdleTimeFields";
import { SettingsSaveBar } from "./SettingsSaveBar";
import { SettingsSectionRow } from "./SettingsSectionRow";
import { WorkingHoursField } from "./WorkingHoursField";

const DATA_TYPES_TOTAL = 2;

type OrganisationSettingsFieldsProps = {
  organisation: OrganisationProfile;
  onDiscard: () => void;
};

export function OrganisationSettingsFields({
  organisation,
  onDiscard,
}: OrganisationSettingsFieldsProps) {
  const queryClient = useQueryClient();
  const [isDirty, setIsDirty] = useState(false);
  const [windowTrackingEnabled, setWindowTrackingEnabled] = useState(
    organisation.windowTrackingEnabled,
  );
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(
    organisation.screenshotsEnabled,
  );

  const updateMutation = useMutation({
    mutationFn: (input: UpdateOrganisationInput) =>
      updateOrganisation(organisation.id, input),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(
          CURRENT_ORGANISATION_QUERY_KEY,
          result.organisation,
        );
        setIsDirty(false);
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateMutation.mutate(
      buildUpdateOrganisationInput(formData, {
        windowTrackingEnabled,
        screenshotsEnabled,
      }),
    );
  }

  const enabledDataTypes =
    Number(windowTrackingEnabled) + Number(screenshotsEnabled);

  return (
    <div className="flex w-full max-w-6xl flex-col gap-1">
      <h1 className="text-2xl font-semibold text-primary-dark">Settings</h1>
      <p className="mb-4 text-sm text-slate-900/60">
        Company details and how the desktop agent tracks time for your team.
      </p>

      <form
        onSubmit={handleSubmit}
        onChange={() => setIsDirty(true)}
        className="flex flex-col gap-9"
      >
        <SettingsSectionRow
          title="Company profile"
          description="Shown on invoices, exports and invitations."
        >
          <CompanyProfileFields organisation={organisation} />
        </SettingsSectionRow>

        <SettingsSectionRow
          title="Work schedule"
          description="A daily target on the dashboard and timesheets. Informational only — it never caps tracked time."
        >
          <WorkingHoursField organisation={organisation} />
        </SettingsSectionRow>

        <SettingsSectionRow
          title="Idle time"
          description="What happens when nobody touches the keyboard or mouse for a while."
        >
          <IdleTimeFields organisation={organisation} />
        </SettingsSectionRow>

        <SettingsSectionRow
          title="Desktop agent tracking"
          description="Choose what the agent collects. Applies to everyone in this workspace."
          badge={
            <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-input-border bg-white px-3 py-1 text-xs text-slate-900/70">
              <CheckCircle size={14} aria-hidden="true" />
              {enabledDataTypes} of {DATA_TYPES_TOTAL} data types collected
            </span>
          }
        >
          <CaptureSettingsFields
            organisation={organisation}
            windowTrackingEnabled={windowTrackingEnabled}
            onWindowTrackingEnabledChange={(checked) => {
              setWindowTrackingEnabled(checked);
              setIsDirty(true);
            }}
            screenshotsEnabled={screenshotsEnabled}
            onScreenshotsEnabledChange={(checked) => {
              setScreenshotsEnabled(checked);
              setIsDirty(true);
            }}
          />
        </SettingsSectionRow>

        {updateMutation.data && !updateMutation.data.ok && (
          <ErrorMessage message={updateMutation.data.message} />
        )}

        <SettingsSaveBar
          isDirty={isDirty}
          isPending={updateMutation.isPending}
          onDiscard={onDiscard}
        />
      </form>
    </div>
  );
}
