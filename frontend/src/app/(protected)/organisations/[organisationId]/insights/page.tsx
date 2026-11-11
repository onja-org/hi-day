import type { Metadata } from "next";
import { InsightsMemberList } from "@/components/insights/InsightsMemberList";

export const metadata: Metadata = {
  title: "Insights",
};

type InsightsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function InsightsPage({ params }: InsightsPageProps) {
  const { organisationId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-primary-dark">Insights</h1>
      <p className="text-slate-900">Pick a member to see how they work.</p>
      <InsightsMemberList organisationId={organisationId} />
    </div>
  );
}
