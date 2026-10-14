"use client";

import { useState } from "react";
import { NumberFieldWithUnit } from "@/components/NumberFieldWithUnit";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SettingsSectionRow } from "@/components/SettingsSectionRow";
import { ScreenshotDeletePanel } from "./ScreenshotDeletePanel";
import { ScreenshotFrequencyPanel } from "./ScreenshotFrequencyPanel";
import { SettingsSubNav } from "./SettingsSubNav";
import type { SettingsSubNavItem } from "./SettingsSubNav";

type SubNavKey = "frequency" | "retention";

const SUB_NAV: SettingsSubNavItem<SubNavKey>[] = [
  { key: "frequency", label: "Screenshot frequency" },
  { key: "retention", label: "Delete screenshots" },
];

function toNumber(value: FormDataEntryValue | null): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ScreenshotSettings() {
  const [active, setActive] = useState<SubNavKey>("frequency");

  return (
    <div className="grid gap-6 py-6 md:grid-cols-[14rem_1fr] md:gap-8">
      <SettingsSubNav
        label="Screenshots sub-sections"
        items={SUB_NAV}
        active={active}
        onSelect={setActive}
      />

      <div className="min-w-0">
        {active === "frequency" && <ScreenshotFrequencyPanel />}
        {active === "retention" && (
          <div className="flex flex-col gap-10">
            <RetentionPanel />
            <ScreenshotDeletePanel />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Whether screenshots are taken, and how often, belongs to the frequency
 * panel now — "None" is the off switch. This keeps only how long they
 * are kept.
 */
function RetentionPanel() {
  return (
    <SettingsPanel
      buildInput={(formData) => ({
        screenshotRetentionDays: toNumber(
          formData.get("screenshotRetentionDays"),
        ),
      })}
    >
      {(organisation) => (
        <SettingsSectionRow
          title="Delete screenshots"
          description="How long a screenshot is kept before it is removed permanently."
        >
          <div className="rounded-lg border border-input-border bg-white p-5">
            <NumberFieldWithUnit
              name="screenshotRetentionDays"
              label="Delete screenshots after"
              unit="days"
              defaultValue={organisation.screenshotRetentionDays}
              hint="Older screenshots are removed permanently."
            />
          </div>
        </SettingsSectionRow>
      )}
    </SettingsPanel>
  );
}
