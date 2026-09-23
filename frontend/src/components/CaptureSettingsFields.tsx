import type { OrganisationProfile } from "@/types/organisation";

type CaptureSettingsFieldsProps = {
  organisation: OrganisationProfile;
};

/** Split out of OrganisationSettingsForm (past the ~150-line guideline); submission still goes through the parent form's `FormData`. */
export function CaptureSettingsFields({
  organisation,
}: CaptureSettingsFieldsProps) {
  return (
    <>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="windowTrackingEnabled"
          defaultChecked={organisation.windowTrackingEnabled}
          className="h-4 w-4 rounded border-input-border"
        />
        Track window titles (desktop agent)
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="screenshotsEnabled"
          defaultChecked={organisation.screenshotsEnabled}
          className="h-4 w-4 rounded border-input-border"
        />
        Enable screenshots (desktop agent)
      </label>

      <div className="flex flex-col gap-5 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5">
          Screenshot frequency (minutes)
          <input
            name="screenshotFrequencyMinutes"
            type="number"
            min="1"
            step="1"
            defaultValue={Math.round(
              organisation.screenshotFrequencySeconds / 60,
            )}
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          Screenshot retention (days)
          <input
            name="screenshotRetentionDays"
            type="number"
            min="1"
            step="1"
            defaultValue={organisation.screenshotRetentionDays}
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>
    </>
  );
}
