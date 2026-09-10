import { UrlSessionList } from "@/components/UrlSessionList";

type ActivitiesPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function ActivitiesPage({ params }: ActivitiesPageProps) {
  const { organisationId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-primary-dark">Activity</h1>
      <UrlSessionList organisationId={organisationId} />
    </div>
  );
}
