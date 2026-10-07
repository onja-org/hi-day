"use client";

import { IdleTimeFields } from "@/components/IdleTimeFields";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SettingsSectionRow } from "@/components/SettingsSectionRow";
import { WorkingHoursField } from "@/components/WorkingHoursField";
import type { IdleHandling } from "@/types/organisation";

function toNumber(value: FormDataEntryValue | null): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function TimeTrackingSettings() {
  return (
    <SettingsPanel
      buildInput={(formData) => ({
        idleHandling: formData.get("idleHandling") as IdleHandling,
        idleThresholdMinutes: toNumber(formData.get("idleThresholdMinutes")),
        workingHoursPerDay: toNumber(formData.get("workingHoursPerDay")),
      })}
    >
      {(organisation) => (
        <>
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
        </>
      )}
    </SettingsPanel>
  );
}
