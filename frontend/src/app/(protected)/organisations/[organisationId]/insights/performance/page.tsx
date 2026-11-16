import type { Metadata } from "next";
import { MemberPerformanceContent } from "@/components/insights/MemberPerformanceContent";

export const metadata: Metadata = {
  title: "Performance · Insights",
};

type InsightsPerformancePageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function InsightsPerformancePage({ params }: InsightsPerformancePageProps) {
  const { organisationId } = await params;

  return <MemberPerformanceContent organisationId={organisationId} />;
}
