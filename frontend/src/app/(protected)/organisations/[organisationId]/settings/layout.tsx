import type { ReactNode } from "react";
import { RequireRole } from "@/components/RequireRole";
import { SettingsDirtyProvider } from "@/components/SettingsDirtyProvider";
import { SettingsHeader } from "@/components/settings/SettingsHeader";

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
        <div className="flex w-full max-w-6xl flex-col">
          <SettingsHeader organisationId={organisationId} />
          {children}
        </div>
      </SettingsDirtyProvider>
    </RequireRole>
  );
}
