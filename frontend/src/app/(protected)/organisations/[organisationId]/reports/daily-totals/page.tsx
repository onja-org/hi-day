import { DailyTotalsReportPage } from "@/components/reports/DailyTotalsReportPage";

type DailyTotalsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function DailyTotalsPage({ params }: DailyTotalsPageProps) {
  const { organisationId } = await params;

  return <DailyTotalsReportPage organisationId={organisationId} />;
}
