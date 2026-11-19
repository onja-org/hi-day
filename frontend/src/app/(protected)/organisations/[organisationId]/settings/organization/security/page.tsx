import type { Metadata } from "next";
import { SettingsEmptySection } from "@/components/settings/SettingsEmptySection";

export const metadata: Metadata = { title: "Security & log in · Settings" };

export default function SecuritySettingsPage() {
  return (
    <SettingsEmptySection
      title="Security & log in"
      description="Each person can turn on two-step login for their own account from their account page. A setting to require it for everyone will live here."
    />
  );
}
