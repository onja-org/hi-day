import { ScreenshotsPageContent } from "@/components/ScreenshotsPageContent";
import { ActivityTabs } from "@/components/ActivityTabs";

type ScreenshotsActivityPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function ScreenshotsActivityPage({
  params,
}: ScreenshotsActivityPageProps) {
  const { organisationId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-primary-dark">Activity</h1>
      <ActivityTabs organisationId={organisationId} />
      <ScreenshotsPageContent organisationId={organisationId} />
    </div>
  );
}
