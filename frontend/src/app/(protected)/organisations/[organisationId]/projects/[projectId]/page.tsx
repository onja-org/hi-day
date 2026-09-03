import { ProjectDetailContent } from "@/components/ProjectDetailContent";

type ProjectDetailPageProps = {
  params: Promise<{ organisationId: string; projectId: string }>;
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { organisationId, projectId } = await params;

  return <ProjectDetailContent organisationId={organisationId} projectId={projectId} />;
}
