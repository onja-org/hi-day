import { ActivityTabs } from "@/components/ActivityTabs";
import { NotesPageContent } from "@/components/NotesPageContent";

type NotesActivityPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function NotesActivityPage({ params }: NotesActivityPageProps) {
  const { organisationId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-primary-dark">Activity</h1>
      <ActivityTabs organisationId={organisationId} />
      <NotesPageContent organisationId={organisationId} />
    </div>
  );
}
