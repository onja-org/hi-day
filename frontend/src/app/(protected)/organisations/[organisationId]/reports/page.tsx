import { ReportsPageContent } from "@/components/ReportsPageContent";

type ReportsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { organisationId } = await params;

  return <ReportsPageContent organisationId={organisationId} />;
}
