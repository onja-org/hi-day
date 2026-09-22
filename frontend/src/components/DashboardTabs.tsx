"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCanViewOthers } from "@/hooks/useCanViewOthers";

type DashboardTabsProps = {
  organisationId: string;
};

export function DashboardTabs({ organisationId }: DashboardTabsProps) {
  const pathname = usePathname();
  const canViewOthers = useCanViewOthers();

  // A plain member only ever has a "Me" dashboard — no tab bar at all, so
  // their page looks exactly as it did before the "All" tab existed.
  if (!canViewOthers) {
    return null;
  }

  const meHref = `/dashboard/${organisationId}/me`;
  const allHref = `/dashboard/${organisationId}/all`;
  const tabs = [
    { label: "Me", href: meHref },
    { label: "All", href: allHref },
  ];

  return (
    <nav className="flex gap-1 border-b border-input-border">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
              isActive && "border-primary text-primary",
              !isActive &&
                "border-transparent text-slate-900 hover:text-primary-dark",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
