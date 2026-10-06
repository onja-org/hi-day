import type { Metadata } from "next";
import { TasksPageContent } from "@/components/TasksPageContent";

export const metadata: Metadata = {
  title: "Tasks",
};

type TasksPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function TasksPage({ params }: TasksPageProps) {
  const { organisationId } = await params;

  return <TasksPageContent organisationId={organisationId} />;
}
