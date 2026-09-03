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
  const isAdmin = organisationQuery.data?.role === "admin";
  const canSeeMembers = isAdmin || organisationQuery.data?.role === "manager";

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
    ...(isAdmin
      ? [
          {
            label: "Teams",
            href: `/organisations/${organisationId}/teams`,
            icon: UsersThree,
          },
        ]
      : []),
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

      <nav className="hidden shrink-0 flex-col bg-sidebar pt-12 sm:sticky sm:top-0 sm:flex sm:h-screen sm:w-20 lg:w-88">
        <div className="flex flex-col gap-1 px-2 py-4 lg:px-3 lg:py-0">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={clsx(
                  "flex items-center justify-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium  transition-colors duration-150 lg:justify-start",
                  isActive &&
                    "bg-sidebar-active text-primary hover:bg-sidebar-active hover:text-primary",
                    !isActive && 'text-slate-900 hover:text-primary-dark hover:bg-white'
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
