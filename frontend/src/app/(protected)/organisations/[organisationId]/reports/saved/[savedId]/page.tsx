import { SavedReportPage } from "@/components/reports/SavedReportPage";

type SavedReportRouteProps = {
  params: Promise<{ organisationId: string; savedId: string }>;
};

export default async function SavedReportRoute({ params }: SavedReportRouteProps) {
  const { organisationId, savedId } = await params;

  return <SavedReportPage organisationId={organisationId} savedReportId={savedId} />;
}
