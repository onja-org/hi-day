import { WorkSessionsReportPage } from "@/components/reports/WorkSessionsReportPage";

type WorkSessionsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function WorkSessionsPage({ params }: WorkSessionsPageProps) {
  const { organisationId } = await params;

  return <WorkSessionsReportPage organisationId={organisationId} />;
}
