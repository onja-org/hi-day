import { TimeEntriesPageContent } from "@/components/TimeEntriesPageContent";

type TimeEntriesPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function TimeEntriesPage({ params }: TimeEntriesPageProps) {
  const { organisationId } = await params;

  return <TimeEntriesPageContent organisationId={organisationId} />;
}
