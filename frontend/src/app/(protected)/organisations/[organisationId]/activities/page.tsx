import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Activity",
};

type ActivitiesPageProps = {
  params: Promise<{ organisationId: string }>;
};

// The bare /activities path has no content of its own — it opens on the
// first tab (Apps), matching ActivityTabs' own ordering. Notes moved to
// its own /activities/notes route so it no longer needs to live here.
export default async function ActivitiesPage({ params }: ActivitiesPageProps) {
  const { organisationId } = await params;

  redirect(`/organisations/${organisationId}/activities/apps`);
}
