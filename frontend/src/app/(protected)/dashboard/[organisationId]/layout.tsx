import type { ReactNode } from "react";
import { DashboardLayoutShell } from "@/components/DashboardLayoutShell";
import { OrganisationGuard } from "@/components/OrganisationGuard";

type DashboardOrganisationLayoutProps = {
  children: ReactNode;
  params: Promise<{ organisationId: string }>;
};

export default async function DashboardOrganisationLayout({
  children,
  params,
}: DashboardOrganisationLayoutProps) {
  const organisationId = Number((await params).organisationId);

  return (
    <DashboardLayoutShell organisationId={organisationId}>
      <OrganisationGuard organisationId={organisationId}>
        {children}
      </OrganisationGuard>
    </DashboardLayoutShell>
  );
}
