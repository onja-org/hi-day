import { TasksPageContent } from "@/components/TasksPageContent";

type TasksPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function TasksPage({ params }: TasksPageProps) {
  const { organisationId } = await params;

  return <TasksPageContent organisationId={organisationId} />;
}
