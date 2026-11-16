import type { Metadata } from "next";
import { MemberTimelineContent } from "@/components/insights/MemberTimelineContent";

export const metadata: Metadata = {
  title: "Timeline · Insights",
};

type InsightsTimelinePageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function InsightsTimelinePage({ params }: InsightsTimelinePageProps) {
  const { organisationId } = await params;

  return <MemberTimelineContent organisationId={organisationId} />;
}
