"use client";

import { useState } from "react";
import { IdleHandlingFields } from "@/components/IdleHandlingFields";
import { IdleTimeoutField } from "@/components/IdleTimeoutField";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SettingsSectionRow } from "@/components/SettingsSectionRow";
import { WorkingHoursField } from "@/components/WorkingHoursField";
import type { IdleHandling } from "@/types/organisation";
import { AllowedAppsPanel } from "./AllowedAppsPanel";
import { SettingsSubNav } from "./SettingsSubNav";
import type { SettingsSubNavItem } from "./SettingsSubNav";

type SubNavKey =
  | "allowed-apps"
  | "idle-timeout"
  | "keep-idle-time"
  | "work-schedule";

const SUB_NAV: SettingsSubNavItem<SubNavKey>[] = [
  { key: "allowed-apps", label: "Allowed apps" },
  { key: "idle-timeout", label: "Idle timeout" },
  { key: "keep-idle-time", label: "Keep idle time" },
  { key: "work-schedule", label: "Work schedule" },
];

function toNumber(value: FormDataEntryValue | null): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function TimeTrackingSettings() {
  const [active, setActive] = useState<SubNavKey>("allowed-apps");

  return (
    <div className="grid gap-6 py-6 md:grid-cols-[14rem_1fr] md:gap-8">
      <SettingsSubNav
        label="Time & tracking sub-sections"
        items={SUB_NAV}
        active={active}
        onSelect={setActive}
      />

      <div className="min-w-0">
        {active === "allowed-apps" && <AllowedAppsPanel />}
        {active === "idle-timeout" && <IdleTimeoutPanel />}
        {active === "keep-idle-time" && <KeepIdleTimePanel />}
        {active === "work-schedule" && <WorkSchedulePanel />}
      </div>
    </div>
  );
}

function IdleTimeoutPanel() {
  return (
    <SettingsPanel
      buildInput={(formData) => ({
        idleThresholdMinutes: toNumber(formData.get("idleThresholdMinutes")),
      })}
    >
      {(organisation) => (
        <SettingsSectionRow
          title="Idle timeout"
          description="How long without keyboard or mouse input before a stretch counts as idle."
        >
          <IdleTimeoutField organisation={organisation} />
        </SettingsSectionRow>
      )}
    </SettingsPanel>
  );
}

function KeepIdleTimePanel() {
  return (
    <SettingsPanel
      buildInput={(formData) => ({
        idleHandling: formData.get("idleHandling") as IdleHandling,
      })}
    >
      {(organisation) => (
        <SettingsSectionRow
          title="Keep idle time"
          description="What happens to a stretch once it counts as idle."
        >
          <IdleHandlingFields organisation={organisation} />
        </SettingsSectionRow>
      )}
    </SettingsPanel>
  );
}

function WorkSchedulePanel() {
  return (
    <SettingsPanel
      buildInput={(formData) => ({
        workingHoursPerDay: toNumber(formData.get("workingHoursPerDay")),
      })}
    >
      {(organisation) => (
        <SettingsSectionRow
          title="Work schedule"
          description="A daily target on the dashboard and timesheets. Informational only — it never caps tracked time."
        >
          <WorkingHoursField organisation={organisation} />
        </SettingsSectionRow>
      )}
    </SettingsPanel>
  );
}
