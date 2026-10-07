"use client";

import { SettingsPanel } from "@/components/SettingsPanel";
import { SettingsSectionRow } from "@/components/SettingsSectionRow";
import { Toggle } from "@/components/Toggle";

export function ActivitySettings() {
  return (
    <SettingsPanel
      buildInput={(formData) => ({
        windowTrackingEnabled: formData.get("windowTrackingEnabled") !== null,
      })}
    >
      {(organisation) => (
        <SettingsSectionRow
          title="Apps & window titles"
          description="What the desktop agent records while a timer is running. Applies to everyone in this workspace."
        >
          <div className="rounded-lg border border-input-border bg-white p-5">
            <Toggle
              name="windowTrackingEnabled"
              label="Window titles"
              description="Records the title of the active window, such as the document or page name."
              defaultChecked={organisation.windowTrackingEnabled}
            />
          </div>
        </SettingsSectionRow>
      )}
    </SettingsPanel>
  );
}
