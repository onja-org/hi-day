import type { Metadata } from "next";
import { TimesheetSettings } from "@/components/settings/TimesheetSettings";

export const metadata: Metadata = { title: "Timesheets · Settings" };

export default function TimesheetSettingsPage() {
  return <TimesheetSettings />;
}
