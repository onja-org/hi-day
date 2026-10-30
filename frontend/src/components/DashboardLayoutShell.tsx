"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { DesktopAppPrompt } from "./DesktopAppPrompt";
import { FadeIn } from "./FadeIn";
import { Sidebar } from "./Sidebar";
import { TrialBanner } from "./TrialBanner";

type DashboardLayoutShellProps = {
  organisationId: number;
  children: ReactNode;
};

export function DashboardLayoutShell({
  organisationId,
  children,
}: DashboardLayoutShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <Sidebar
        organisationId={organisationId}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader onOpenMenu={() => setMobileMenuOpen(true)} />
        <TrialBanner organisationId={organisationId} />
        <main className="container flex-1 py-8">
          <FadeIn>{children}</FadeIn>
        </main>
      </div>
      <DesktopAppPrompt />
    </div>
  );
}
