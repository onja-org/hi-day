import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Activity",
};

type ActivitiesPageProps = {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The bare /activities path has no content of its own — it opens on the
// first tab (Apps), matching ActivityTabs' own ordering. Notes moved to
// its own /activities/notes route so it no longer needs to live here. The
// day/member/project filters carry over, as they do between tabs.
export default async function ActivitiesPage({
  params,
  searchParams,
}: ActivitiesPageProps) {
  const { organisationId } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of [value ?? []].flat()) query.append(key, item);
  }
  const search = query.toString();

  redirect(
    `/organisations/${organisationId}/activities/apps${search ? `?${search}` : ""}`,
  );
}
