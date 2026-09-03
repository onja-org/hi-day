import type { ReactNode } from "react";
import { DashboardLayoutShell } from "@/components/DashboardLayoutShell";
import { OrganisationGuard } from "@/components/OrganisationGuard";

type OrganisationLayoutProps = {
  children: ReactNode;
  params: Promise<{ organisationId: string }>;
};

export default async function OrganisationLayout({
  children,
  params,
}: OrganisationLayoutProps) {
  const organisationId = Number((await params).organisationId);

  return (
    <DashboardLayoutShell organisationId={organisationId}>
      <OrganisationGuard organisationId={organisationId}>
        {children}
      </OrganisationGuard>
    </DashboardLayoutShell>
  );
}
