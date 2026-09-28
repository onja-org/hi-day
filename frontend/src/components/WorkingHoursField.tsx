import { useState } from "react";
import type { OrganisationProfile } from "@/types/organisation";
import { NumberFieldWithUnit } from "./NumberFieldWithUnit";

type WorkingHoursFieldProps = {
  organisation: OrganisationProfile;
};

/** Split out of OrganisationSettingsForm (past the ~150-line guideline); submission still goes through the parent form's `FormData`. */
export function WorkingHoursField({ organisation }: WorkingHoursFieldProps) {
  const [hoursPerDay, setHoursPerDay] = useState(
    organisation.workingHoursPerDay,
  );

  return (
    <div className="rounded-lg border border-input-border bg-white p-5">
      <NumberFieldWithUnit
        name="workingHoursPerDay"
        label="Working hours per day"
        unit="hrs"
        min={1}
        max={24}
        value={hoursPerDay}
        onChange={setHoursPerDay}
        hint={`= ${hoursPerDay * 5} h over a 5-day week`}
      />
    </div>
  );
}
