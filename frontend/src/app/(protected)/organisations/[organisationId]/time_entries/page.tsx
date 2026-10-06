import type { Metadata } from "next";
import { TimeEntriesPageContent } from "@/components/TimeEntriesPageContent";

export const metadata: Metadata = {
  title: "Timesheets",
};

type TimeEntriesPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function TimeEntriesPage({ params }: TimeEntriesPageProps) {
  const { organisationId } = await params;

  return <TimeEntriesPageContent organisationId={organisationId} />;
}
