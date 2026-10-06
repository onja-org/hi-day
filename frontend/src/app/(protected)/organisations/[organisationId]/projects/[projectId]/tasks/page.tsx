import type { Metadata } from "next";
import { ProjectTasksPageContent } from "@/components/ProjectTasksPageContent";

export const metadata: Metadata = {
  title: "Project tasks",
};

type ProjectTasksPageProps = {
  params: Promise<{ organisationId: string; projectId: string }>;
};

export default async function ProjectTasksPage({ params }: ProjectTasksPageProps) {
  const { organisationId, projectId } = await params;

  return (
    <ProjectTasksPageContent organisationId={organisationId} projectId={projectId} />
  );
}
