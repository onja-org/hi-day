import type { Metadata } from "next";
import { SettingsEmptySection } from "@/components/settings/SettingsEmptySection";

export const metadata: Metadata = { title: "Timesheets · Settings" };

export default function TimesheetSettingsPage() {
  return (
    <SettingsEmptySection
      title="Timesheets"
      description="Who may modify time, whether edits need approval, and whether a reason is required. Nothing to configure yet."
    />
  );
}
