import type { Metadata } from "next";
import { RequireProjectsEnabled } from "@/components/RequireProjectsEnabled";
import { ProjectDetailContent } from "@/components/ProjectDetailContent";

export const metadata: Metadata = {
  title: "Project",
};

type ProjectDetailPageProps = {
  params: Promise<{ organisationId: string; projectId: string }>;
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { organisationId, projectId } = await params;

  return (
    <RequireProjectsEnabled>
      <ProjectDetailContent organisationId={organisationId} projectId={projectId} />
    </RequireProjectsEnabled>
  );
}
