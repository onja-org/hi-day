import { SettingsMenu } from "@/components/SettingsMenu";

export default function DashboardPage() {
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold text-primary-dark">Dashboard</h1>
      <SettingsMenu />
    </main>
  );
}
