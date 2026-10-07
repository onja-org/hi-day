import type { Metadata } from "next";
import { ActivitySettings } from "@/components/settings/ActivitySettings";

export const metadata: Metadata = { title: "Activity · Settings" };

export default function ActivitySettingsPage() {
  return <ActivitySettings />;
}
