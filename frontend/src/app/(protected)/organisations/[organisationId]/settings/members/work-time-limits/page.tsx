import type { Metadata } from "next";
import { WorkTimeLimitsSettings } from "@/components/settings/WorkTimeLimitsSettings";

export const metadata: Metadata = { title: "Work time limits · Settings" };

export default function WorkTimeLimitsSettingsPage() {
  return <WorkTimeLimitsSettings />;
}
