"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  Briefcase,
  ChartLineUp,
  Clock,
  Desktop,
  Gauge,
  Users,
  UsersThree,
} from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { MobileSidebarDrawer } from "./MobileSidebarDrawer";

type SidebarProps = {
  organisationId: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

type NavItem = {
  label: string;
  href: string;
  icon: Icon;
};

export function Sidebar({ organisationId, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const organisationQuery = useCurrentOrganisation();
  const organisationName = organisationQuery.data?.name ?? "Workforce";
  const canSeeMembers =
    organisationQuery.data?.role === "admin" ||
    organisationQuery.data?.role === "manager";

  const items: NavItem[] = [
    { label: "Dashboard", href: `/dashboard/${organisationId}/me`, icon: Gauge },
    {
      label: "Timesheets",
      href: `/organisations/${organisationId}/time_entries`,
      icon: Clock,
    },
    {
      label: "Activity",
      href: `/organisations/${organisationId}/activities`,
      icon: ChartLineUp,
    },
    {
      label: "Teams",
      href: `/organisations/${organisationId}/teams`,
      icon: UsersThree,
    },
    ...(canSeeMembers
      ? [
          {
            label: "Projects",
            href: `/organisations/${organisationId}/projects`,
            icon: Briefcase,
          },
          {
            label: "Members",
            href: `/organisations/${organisationId}/members`,
            icon: Users,
          },
          {
            label: "Devices",
            href: `/organisations/${organisationId}/devices`,
            icon: Desktop,
          },
        ]
      : []),
  ];

  return (
    <>
      {mobileOpen && (
        <MobileSidebarDrawer
          items={items}
          pathname={pathname}
          organisationName={organisationName}
          onClose={onCloseMobile}
        />
      )}

      <nav className="hidden shrink-0 flex-col bg-sidebar sm:sticky sm:top-0 sm:flex sm:h-screen sm:w-16 lg:w-52">
        <div className="flex items-center justify-center gap-2 border-b border-primary-dark/10 px-2 py-4 lg:justify-start lg:px-5">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-dark text-sm font-bold text-white"
          >
            W
          </span>
          <span className="hidden text-base font-semibold text-primary-dark lg:inline">
            Workforce
          </span>
        </div>

        <div className="flex flex-col gap-1 py-4">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={clsx(
                  "flex items-center justify-center gap-3 rounded-r-md border-l-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150 lg:justify-start lg:pl-4",
                  isActive && "border-primary bg-white text-primary",
                  !isActive &&
                    "border-transparent text-slate-900 hover:border-primary/30 hover:bg-white hover:text-primary-dark",
                )}
              >
                <item.icon size={20} aria-hidden="true" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
