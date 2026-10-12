"use client";

import { SelectField } from "@/components/ui/form";
import { timezoneOptions } from "@/lib/timezoneOptions";
import type { OrganisationProfile } from "@/types/organisation";

/** Kept apart from the company's identity fields because the caveat below
 * applies to these two settings and to nothing else on the form. */
export function CompanyRegionalFields({
  organisation,
}: {
  organisation: OrganisationProfile;
}) {
  const groups = timezoneOptions(organisation.timezone);

  return (
    <div className="@container flex flex-col gap-4 rounded-lg border border-input-border bg-white p-5">
      <div className="grid gap-4 @md:grid-cols-2">
        <SelectField
          label="Time zone"
          name="timezone"
          defaultValue={organisation.timezone}
          required
        >
          {groups.map((group) => (
            <optgroup key={group.region} label={group.region}>
              {group.zones.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>

        <SelectField
          label="Start week on"
          name="weekStartsOn"
          defaultValue={organisation.weekStartsOn}
          required
        >
          <option value="monday">Monday</option>
          <option value="sunday">Sunday</option>
        </SelectField>
      </div>

      <p className="text-xs text-slate-900/60">
        Changing either of these re-reads time that is already recorded. No
        entry moves and no hours are lost, but which day or week an entry
        falls into is worked out fresh each time a page loads — so totals you
        have already seen on the dashboard, timesheets and reports can come
        out differently for past days and weeks too.
      </p>
    </div>
  );
}
