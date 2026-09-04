import { DashboardSections } from "@/components/DashboardSections";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-primary-dark">Dashboard Dummy Content</h1>
      <DashboardSections />
    </div>
  );
}
