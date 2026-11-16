import type { Metadata } from "next";
import { MemberHighlightsContent } from "@/components/insights/MemberHighlightsContent";

export const metadata: Metadata = {
  title: "Highlights · Insights",
};

type InsightsHighlightsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function InsightsHighlightsPage({ params }: InsightsHighlightsPageProps) {
  const { organisationId } = await params;

  return <MemberHighlightsContent organisationId={organisationId} />;
}
