import type { Metadata } from "next";
import { ProjectsPageContent } from "@/components/ProjectsPageContent";

export const metadata: Metadata = {
  title: "Projects",
};

type ProjectsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function ProjectsPage({ params }: ProjectsPageProps) {
  const { organisationId } = await params;

  return <ProjectsPageContent organisationId={organisationId} />;
}
