import type { ReactNode } from "react";
import { RequireRole } from "@/components/RequireRole";
import { SettingsDirtyProvider } from "@/components/SettingsDirtyProvider";
import { SettingsNav } from "@/components/SettingsNav";

type SettingsLayoutProps = {
  children: ReactNode;
  params: Promise<{ organisationId: string }>;
};

export default async function SettingsLayout({
  children,
  params,
}: SettingsLayoutProps) {
  const { organisationId } = await params;

  return (
    <RequireRole role="admin">
      <SettingsDirtyProvider>
        <div className="flex w-full max-w-6xl flex-col gap-1">
          <h1 className="text-2xl font-semibold text-primary-dark">Settings</h1>
          <p className="mb-6 text-sm text-slate-900/60">
            Company details and how the desktop agent tracks time for your team.
          </p>

          <SettingsNav organisationId={organisationId}>{children}</SettingsNav>
        </div>
      </SettingsDirtyProvider>
    </RequireRole>
  );
}
