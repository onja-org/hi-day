import { ProjectsPageContent } from "@/components/ProjectsPageContent";

type ProjectsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function ProjectsPage({ params }: ProjectsPageProps) {
  const { organisationId } = await params;

  return <ProjectsPageContent organisationId={organisationId} />;
}
