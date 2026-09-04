import { TeamsPageContent } from "@/components/TeamsPageContent";

type TeamsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { organisationId } = await params;

  return <TeamsPageContent organisationId={organisationId} />;
}
