import { ManualTimeEditsReportPage } from "@/components/reports/ManualTimeEditsReportPage";

type ManualTimeEditsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function ManualTimeEditsPage({ params }: ManualTimeEditsPageProps) {
  const { organisationId } = await params;

  return <ManualTimeEditsReportPage organisationId={organisationId} />;
}
