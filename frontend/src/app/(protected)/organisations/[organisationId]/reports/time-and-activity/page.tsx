import { TimeActivityReportPage } from "@/components/reports/TimeActivityReportPage";

type TimeActivityPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function TimeActivityPage({ params }: TimeActivityPageProps) {
  const { organisationId } = await params;

  return <TimeActivityReportPage organisationId={organisationId} />;
}
