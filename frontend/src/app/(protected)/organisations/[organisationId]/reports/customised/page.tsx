import { CustomisedReportsPageContent } from "@/components/reports/CustomisedReportsPageContent";

type CustomisedReportsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function CustomisedReportsPage({ params }: CustomisedReportsPageProps) {
  const { organisationId } = await params;

  return <CustomisedReportsPageContent organisationId={organisationId} />;
}
