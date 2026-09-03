import { MembersPageContent } from "@/components/MembersPageContent";

type MembersPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function MembersPage({ params }: MembersPageProps) {
  const { organisationId } = await params;

  return <MembersPageContent organisationId={organisationId} />;
}
