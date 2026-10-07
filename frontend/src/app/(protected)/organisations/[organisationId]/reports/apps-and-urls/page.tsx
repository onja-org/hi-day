import { AppsUrlsReportPage } from "@/components/reports/AppsUrlsReportPage";

type AppsUrlsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function AppsUrlsPage({ params }: AppsUrlsPageProps) {
  const { organisationId } = await params;

  return <AppsUrlsReportPage organisationId={organisationId} />;
}
