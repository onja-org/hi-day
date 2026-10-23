import { notFound, redirect } from "next/navigation";
import { getCurrentOrganisationId } from "@/lib/getCurrentOrganisationId";
import { organisationPathFor } from "@/lib/organisationPathFor";

type OpenDestinationPageProps = {
  params: Promise<{ destination: string }>;
};

/** `/open/timesheet`, `/open/notes`: see `organisationPathFor`. */
export default async function OpenDestinationPage({ params }: OpenDestinationPageProps) {
  const { destination } = await params;
  const organisationId = await getCurrentOrganisationId();

  if (!organisationId) {
    redirect("/");
  }

  const path = organisationPathFor(destination, organisationId);

  if (!path) {
    notFound();
  }

  redirect(path);
}
