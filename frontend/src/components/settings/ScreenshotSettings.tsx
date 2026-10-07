"use client";

import { useState } from "react";
import { NumberFieldWithUnit } from "@/components/NumberFieldWithUnit";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SettingsSectionRow } from "@/components/SettingsSectionRow";
import { Toggle } from "@/components/Toggle";
import type { OrganisationProfile } from "@/types/organisation";

const MINUTES_PER_WORKING_DAY = 8 * 60;

function ScreenshotFields({ organisation }: { organisation: OrganisationProfile }) {
  const [frequencyMinutes, setFrequencyMinutes] = useState(
    Math.round(organisation.screenshotFrequencySeconds / 60),
  );

  return (
    <div className="@container flex flex-col gap-5 rounded-lg border border-input-border bg-white p-5">
      <Toggle
        name="screenshotsEnabled"
        label="Screenshots"
        description="Periodic screen captures at the interval set below."
        defaultChecked={organisation.screenshotsEnabled}
      />

      <div className="grid gap-4 border-t border-input-border pt-5 @md:grid-cols-2">
        <NumberFieldWithUnit
          name="screenshotFrequencyMinutes"
          label="Capture every"
          unit="min"
          value={frequencyMinutes}
          onChange={setFrequencyMinutes}
          hint={`= ${Math.round(MINUTES_PER_WORKING_DAY / frequencyMinutes)} captures per 8-hour day`}
        />
        <NumberFieldWithUnit
          name="screenshotRetentionDays"
          label="Delete screenshots after"
          unit="days"
          defaultValue={organisation.screenshotRetentionDays}
          hint="Older screenshots are removed permanently."
        />
      </div>
    </div>
  );
}

function toNumber(value: FormDataEntryValue | null): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ScreenshotSettings() {
  return (
    <SettingsPanel
      buildInput={(formData) => {
        const minutes = toNumber(formData.get("screenshotFrequencyMinutes"));
        return {
          screenshotsEnabled: formData.get("screenshotsEnabled") !== null,
          screenshotFrequencySeconds: minutes === undefined ? undefined : minutes * 60,
          screenshotRetentionDays: toNumber(formData.get("screenshotRetentionDays")),
        };
      }}
    >
      {(organisation) => (
        <SettingsSectionRow
          title="Screenshots"
          description="Whether screens are captured, how often, and how long they are kept."
        >
          <ScreenshotFields organisation={organisation} />
        </SettingsSectionRow>
      )}
    </SettingsPanel>
  );
}
