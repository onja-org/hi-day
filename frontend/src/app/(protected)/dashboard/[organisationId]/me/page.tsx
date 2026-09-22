import { DashboardSections } from "@/components/DashboardSections";
import { DashboardTabs } from "@/components/DashboardTabs";

type MeDashboardPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function DashboardPage({ params }: MeDashboardPageProps) {
  const { organisationId } = await params;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-primary-dark">Dashboard</h1>
      <DashboardTabs organisationId={organisationId} />
      <DashboardSections />
    </div>
  );
}
