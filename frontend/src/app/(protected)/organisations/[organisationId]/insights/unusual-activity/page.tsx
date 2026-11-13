import type { Metadata } from "next";
import { MemberUnusualActivityContent } from "@/components/insights/MemberUnusualActivityContent";

export const metadata: Metadata = {
  title: "Unusual activity · Insights",
};

type InsightsUnusualActivityPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function InsightsUnusualActivityPage({ params }: InsightsUnusualActivityPageProps) {
  const { organisationId } = await params;

  return <MemberUnusualActivityContent organisationId={organisationId} />;
}
