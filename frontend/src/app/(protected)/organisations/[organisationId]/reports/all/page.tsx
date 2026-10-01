import { AllReportsPageContent } from "@/components/reports/AllReportsPageContent";

type AllReportsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function AllReportsPage({ params }: AllReportsPageProps) {
  const { organisationId } = await params;

  return <AllReportsPageContent organisationId={Number(organisationId)} />;
}
