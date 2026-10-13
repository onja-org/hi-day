import type { OrganisationProfile } from "@/types/organisation";
import { NumberFieldWithUnit } from "./NumberFieldWithUnit";

type IdleTimeoutFieldProps = {
  organisation: OrganisationProfile;
};

/** "Idle timeout": how long without input before a stretch counts as idle.
 * What then happens to it is `IdleHandlingFields`. */
export function IdleTimeoutField({ organisation }: IdleTimeoutFieldProps) {
  return (
    <div className="rounded-lg border border-input-border bg-white p-5">
      <NumberFieldWithUnit
        name="idleThresholdMinutes"
        label="Count as idle after"
        unit="min"
        hint="No keyboard or mouse input for this long starts an idle period."
        defaultValue={organisation.idleThresholdMinutes}
      />
    </div>
  );
}
