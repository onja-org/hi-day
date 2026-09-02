import { redirect } from "next/navigation";
import { getCurrentOrganisationId } from "@/lib/getCurrentOrganisationId";

export default async function DashboardRedirectPage() {
  const organisationId = await getCurrentOrganisationId();

  if (!organisationId) {
    redirect("/");
  }

  redirect(`/dashboard/${organisationId}/me`);
}
