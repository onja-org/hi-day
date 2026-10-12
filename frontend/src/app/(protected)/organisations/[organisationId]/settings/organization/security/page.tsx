import type { Metadata } from "next";
import { SettingsEmptySection } from "@/components/settings/SettingsEmptySection";

export const metadata: Metadata = { title: "Security & log in · Settings" };

export default function SecuritySettingsPage() {
  return (
    <SettingsEmptySection
      title="Security & log in"
      description="Two-factor authentication and single sign-on will live here. Nothing to configure yet."
    />
  );
}
