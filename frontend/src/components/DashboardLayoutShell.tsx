"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { DesktopAppPrompt } from "./DesktopAppPrompt";
import { FadeIn } from "./FadeIn";
import { Sidebar } from "./Sidebar";
import { TrialBanner } from "./TrialBanner";
import { useBillingEnabled } from "@/hooks/useBillingEnabled";

type DashboardLayoutShellProps = {
  organisationId: number;
  children: ReactNode;
};

export function DashboardLayoutShell({
  organisationId,
  children,
}: DashboardLayoutShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const billingEnabled = useBillingEnabled();

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <Sidebar
        organisationId={organisationId}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader onOpenMenu={() => setMobileMenuOpen(true)} />
        {/* No trial, so nothing to count down — a self-hosted install is
            free forever and must never be shown a countdown to paying.
            False while the flag is still loading, so nothing flashes. */}
        {billingEnabled && <TrialBanner organisationId={organisationId} />}
        <main className="container flex-1 py-8">
          <FadeIn>{children}</FadeIn>
        </main>
      </div>
      <DesktopAppPrompt />
    </div>
  );
}
