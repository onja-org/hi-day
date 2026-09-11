import { AppActivityPageContent } from "@/components/AppActivityPageContent";
import { ActivityTabs } from "@/components/ActivityTabs";

type AppActivityPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function AppActivityPage({ params }: AppActivityPageProps) {
  const { organisationId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-primary-dark">Activity</h1>
      <ActivityTabs organisationId={organisationId} />
      <AppActivityPageContent organisationId={organisationId} />
    </div>
  );
}
