import type { OrganisationProfile } from "@/types/organisation";

type WorkingHoursFieldProps = {
  organisation: OrganisationProfile;
};

/** Split out of OrganisationSettingsForm (past the ~150-line guideline); submission still goes through the parent form's `FormData`. */
export function WorkingHoursField({ organisation }: WorkingHoursFieldProps) {
  return (
    <label className="flex flex-col gap-1.5 sm:max-w-xs">
      Working hours per day
      <input
        name="workingHoursPerDay"
        type="number"
        min="1"
        max="24"
        step="1"
        defaultValue={organisation.workingHoursPerDay}
        className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <span className="text-xs text-slate-900/60">
        Shown as a daily target on the dashboard and timesheets —
        informational only, never a limit on tracked time.
      </span>
    </label>
  );
}
