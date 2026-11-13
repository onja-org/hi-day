import type { Metadata } from "next";
import { WorkClassificationSettings } from "@/components/settings/WorkClassificationSettings";

export const metadata: Metadata = { title: "Work time classification · Settings" };

export default function WorkClassificationSettingsPage() {
  return <WorkClassificationSettings />;
}
