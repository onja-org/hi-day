import type { Metadata } from "next";
import { TeamsPageContent } from "@/components/TeamsPageContent";

export const metadata: Metadata = {
  title: "Teams",
};

type TeamsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { organisationId } = await params;

  return <TeamsPageContent organisationId={organisationId} />;
}
