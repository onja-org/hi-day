import type { Metadata } from "next";
import { ActivityTabs } from "@/components/ActivityTabs";
import { UrlActivityPageContent } from "@/components/UrlActivityPageContent";

export const metadata: Metadata = {
  title: "URL activity",
};

type UrlActivityPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function UrlActivityPage({ params }: UrlActivityPageProps) {
  const { organisationId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-primary-dark">Activity</h1>
      <ActivityTabs organisationId={organisationId} />
      <UrlActivityPageContent organisationId={organisationId} />
    </div>
  );
}
