import { useState } from "react";
import type { OrganisationProfile } from "@/types/organisation";
import { NumberFieldWithUnit } from "./NumberFieldWithUnit";
import { Toggle } from "./Toggle";

type CaptureSettingsFieldsProps = {
  organisation: OrganisationProfile;
  windowTrackingEnabled: boolean;
  onWindowTrackingEnabledChange: (checked: boolean) => void;
  screenshotsEnabled: boolean;
  onScreenshotsEnabledChange: (checked: boolean) => void;
};

/** Split out of OrganisationSettingsForm (past the ~150-line guideline); submission still goes through the parent form's `FormData`. */
export function CaptureSettingsFields({
  organisation,
  windowTrackingEnabled,
  onWindowTrackingEnabledChange,
  screenshotsEnabled,
  onScreenshotsEnabledChange,
}: CaptureSettingsFieldsProps) {
  const [screenshotFrequencyMinutes, setScreenshotFrequencyMinutes] =
    useState(Math.round(organisation.screenshotFrequencySeconds / 60));

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-input-border bg-white p-5">
      <div className="divide-y divide-input-border">
        <Toggle
          name="windowTrackingEnabled"
          label="Window titles"
          description="Records the title of the active window, such as the document or page name."
          checked={windowTrackingEnabled}
          onCheckedChange={onWindowTrackingEnabledChange}
        />
        <Toggle
          name="screenshotsEnabled"
          label="Screenshots"
          description="Periodic screen captures at the interval set below."
          checked={screenshotsEnabled}
          onCheckedChange={onScreenshotsEnabledChange}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-input-border pt-5">
        <span className="text-sm font-medium text-slate-900">
          Screenshot options
        </span>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberFieldWithUnit
            name="screenshotFrequencyMinutes"
            label="Capture every"
            unit="min"
            value={screenshotFrequencyMinutes}
            onChange={setScreenshotFrequencyMinutes}
            hint={`= ${Math.round((8 * 60) / screenshotFrequencyMinutes)} captures per 8-hour day`}
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
    </div>
  );
}
