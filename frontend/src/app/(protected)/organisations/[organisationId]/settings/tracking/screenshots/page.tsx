import type { Metadata } from "next";
import { ScreenshotSettings } from "@/components/settings/ScreenshotSettings";

export const metadata: Metadata = { title: "Screenshots · Settings" };

export default function ScreenshotSettingsPage() {
  return <ScreenshotSettings />;
}
