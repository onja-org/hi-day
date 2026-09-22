import { DashboardTabs } from "@/components/DashboardTabs";
import { RequireRole } from "@/components/RequireRole";
import { TeamDashboardSections } from "@/components/TeamDashboardSections";

type AllDashboardPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function AllDashboardPage({ params }: AllDashboardPageProps) {
  const { organisationId } = await params;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-primary-dark">Dashboard</h1>
      <DashboardTabs organisationId={organisationId} />
      <RequireRole role={["admin", "manager"]}>
        <TeamDashboardSections />
      </RequireRole>
    </div>
  );
}
