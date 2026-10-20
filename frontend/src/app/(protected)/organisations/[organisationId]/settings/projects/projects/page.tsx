import type { Metadata } from "next";
import { ProjectsSettings } from "@/components/settings/ProjectsSettings";

export const metadata: Metadata = { title: "Projects · Settings" };

export default function ProjectsSettingsPage() {
  return <ProjectsSettings />;
}
