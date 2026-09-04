import { TeamDetailPageContent } from "@/components/TeamDetailPageContent";

type TeamDetailPageProps = {
  params: Promise<{ organisationId: string; teamId: string }>;
};

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const { organisationId, teamId } = await params;

  return (
    <TeamDetailPageContent organisationId={organisationId} teamId={teamId} />
  );
}
