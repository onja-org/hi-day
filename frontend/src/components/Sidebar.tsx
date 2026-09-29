"use client";

import {
  Briefcase,
  ChartLineUp,
  Clock,
  Desktop,
  Gauge,
  Gear,
  User,
  Users,
  UsersThree,
} from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import type { NavEntry, NavLink } from "@/types/navigation";
import { MobileSidebarDrawer } from "./MobileSidebarDrawer";
import { SidebarNavEntries } from "./SidebarNavEntries";

type SidebarProps = {
  organisationId: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({
  organisationId,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const organisationQuery = useCurrentOrganisation();
  const organisationName = organisationQuery.data?.name ?? "Workforce";
  const isAdmin = organisationQuery.data?.role === "admin";
  const canSeeMembers = isAdmin || organisationQuery.data?.role === "manager";

  const peopleLinks: NavLink[] = [
    ...(canSeeMembers
      ? [
          {
            kind: "link" as const,
            label: "Members",
            href: `/organisations/${organisationId}/members`,
            icon: Users,
          },
        ]
      : []),
    {
      kind: "link",
      label: "Teams",
      href: `/organisations/${organisationId}/teams`,
      icon: UsersThree,
    },
  ];

  const entries: NavEntry[] = [
    {
      kind: "link",
      label: "Dashboard",
      href: `/dashboard/${organisationId}/me`,
      icon: Gauge,
    },
    {
      kind: "link",
      label: "Timesheets",
      href: `/organisations/${organisationId}/time_entries`,
      icon: Clock,
    },
    {
      kind: "link",
      label: "Activity",
      href: `/organisations/${organisationId}/activities`,
      icon: ChartLineUp,
    },
    {
      kind: "link",
      label: "Projects",
      href: `/organisations/${organisationId}/projects`,
      icon: Briefcase,
    },
    { kind: "group", label: "People", icon: User, children: peopleLinks },
    ...(canSeeMembers
      ? [
          {
            kind: "link" as const,
            label: "Devices",
            href: `/organisations/${organisationId}/devices`,
            icon: Desktop,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            kind: "link" as const,
            label: "Settings",
            href: `/organisations/${organisationId}/settings`,
            icon: Gear,
          },
        ]
      : []),
  ];

  return (
    <>
      {mobileOpen && (
        <MobileSidebarDrawer
          entries={entries}
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
        <div className="flex flex-col gap-1 px-2 py-4 lg:px-3 lg:py-0">
          <SidebarNavEntries entries={entries} pathname={pathname} variant="rail" />
        </div>
      </nav>
    </>
  );
}
