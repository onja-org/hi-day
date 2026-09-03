import { ProjectTasksPageContent } from "@/components/ProjectTasksPageContent";

type ProjectTasksPageProps = {
  params: Promise<{ organisationId: string; projectId: string }>;
};

export default async function ProjectTasksPage({ params }: ProjectTasksPageProps) {
  const { organisationId, projectId } = await params;

  return (
    <ProjectTasksPageContent organisationId={organisationId} projectId={projectId} />
  );
}
