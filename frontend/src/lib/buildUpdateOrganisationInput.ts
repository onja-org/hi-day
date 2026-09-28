import type { IdleHandling, UpdateOrganisationInput } from "@/types/organisation";

type CaptureFlags = {
  windowTrackingEnabled: boolean;
  screenshotsEnabled: boolean;
};

/** Reads OrganisationSettingsFields' submitted FormData into the API's update shape; capture toggles are controlled state, not FormData, so they're passed in separately. */
export function buildUpdateOrganisationInput(
  formData: FormData,
  captureFlags: CaptureFlags,
): UpdateOrganisationInput {
  const website = formData.get("website");
  const idleThresholdMinutes = Number(formData.get("idleThresholdMinutes"));
  const workingHoursPerDay = Number(formData.get("workingHoursPerDay"));
  const screenshotFrequencyMinutes = Number(
    formData.get("screenshotFrequencyMinutes"),
  );
  const screenshotRetentionDays = Number(
    formData.get("screenshotRetentionDays"),
  );

  return {
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
    windowTrackingEnabled: captureFlags.windowTrackingEnabled,
    screenshotsEnabled: captureFlags.screenshotsEnabled,
    screenshotFrequencySeconds: Number.isFinite(screenshotFrequencyMinutes)
      ? screenshotFrequencyMinutes * 60
      : undefined,
    screenshotRetentionDays: Number.isFinite(screenshotRetentionDays)
      ? screenshotRetentionDays
      : undefined,
  };
}
