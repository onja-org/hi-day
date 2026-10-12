import type { Metadata } from "next";
import { TimeTrackingSettings } from "@/components/settings/TimeTrackingSettings";

export const metadata: Metadata = { title: "Time & tracking · Settings" };

export default function TimeTrackingSettingsPage() {
  return <TimeTrackingSettings />;
}
