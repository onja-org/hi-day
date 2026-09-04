"use client";

import { List } from "@phosphor-icons/react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { HeaderTimerWidget } from "./HeaderTimerWidget";
import { UserMenu } from "./UserMenu";

type DashboardHeaderProps = {
  onOpenMenu: () => void;
};

export function DashboardHeader({ onOpenMenu }: DashboardHeaderProps) {
  const organisationQuery = useCurrentOrganisation();

  return (
    <header className="flex items-center justify-between gap-3 border-b border-primary-dark/10 bg-white px-4 py-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="cursor-pointer text-primary-dark sm:hidden"
        >
          <List size={28} aria-hidden="true" />
        </button>
        <span className="text-lg font-semibold text-primary-dark">
          {organisationQuery.data?.name ?? "Workforce"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {organisationQuery.data && (
          <HeaderTimerWidget organisationId={String(organisationQuery.data.id)} />
        )}
        <UserMenu />
      </div>
    </header>
  );
}
