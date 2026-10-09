import type { Metadata } from "next";
import { SettingsEmptySection } from "@/components/settings/SettingsEmptySection";

export const metadata: Metadata = { title: "Work time limits · Settings" };

export default function WorkTimeLimitsSettingsPage() {
  return (
    <div className="py-6">
      <SettingsEmptySection
        title="Work time limits"
        description="Which days members are expected to work, the hours expected of them weekly, and the daily and weekly ceilings on tracked time — set for the organisation and overridable per member. Nothing to configure yet."
      />
    </div>
  );
}
