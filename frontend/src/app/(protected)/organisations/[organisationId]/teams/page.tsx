import { TeamsList } from "@/components/TeamsList";

type TeamsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { organisationId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-primary-dark">Teams</h1>
      <TeamsList organisationId={organisationId} />
    </div>
  );
}
