"use client";

import {
  Briefcase,
  BookmarkSimple,
  ChartBar,
  ChartLineUp,
  Clock,
  Desktop,
  FolderSimple,
  Gauge,
  Buildings,
  Gear,
  SquaresFour,
  ListChecks,
  Star,
  User,
  Users,
  UsersThree,
} from "@phosphor-icons/react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { settingsHref, SETTINGS_GROUPS } from "@/lib/settingsNavigation";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useFavouriteReports } from "@/hooks/useFavouriteReports";
import { useSavedReports } from "@/hooks/useSavedReports";
import { reportsFor } from "@/lib/reportCatalog";
import type { Icon } from "@phosphor-icons/react";
import type { NavEntry, NavLink } from "@/types/navigation";

/** Keyed to match SettingsCards and SettingsHeader, so a group wears the
 * same icon in the sidebar, on its card, and in its own header. */
const SETTINGS_GROUP_ICONS: Record<string, Icon> = {
  organization: Buildings,
  members: Users,
  projects: FolderSimple,
  tracking: ChartLineUp,
};
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
  const { favouriteIds } = useFavouriteReports(organisationId);
  const { reports: savedReports } = useSavedReports(String(organisationId));
  // A saved report is listed while it's open or starred; the Customised
  // reports page is where the full list lives.
  const openSavedReportId = pathname.match(/\/reports\/saved\/([^/]+)/)?.[1];
  const organisationName = organisationQuery.data?.name ?? "Hi Day";
  const isAdmin = organisationQuery.data?.role === "admin";
  const projectsEnabled = organisationQuery.data?.projectsEnabled ?? false;
  const projectsManageable =
    organisationQuery.data?.projectsManageable ?? false;
  const canSeeMembers = isAdmin || organisationQuery.data?.role === "manager";

  const teamsLink: NavLink = {
    kind: "link",
    label: "Teams",
    href: `/organisations/${organisationId}/teams`,
    icon: UsersThree,
  };
  // Only admins/managers can see Members, so only they get the People
  // group. Everyone else just sees Teams (only the teams they're on — the
  // backend scopes that list) as a standalone link.
  const peopleEntry: NavEntry = canSeeMembers
    ? {
        kind: "group",
        label: "People",
        icon: User,
        children: [
          {
            kind: "link",
            label: "Members",
            href: `/organisations/${organisationId}/members`,
            icon: Users,
          },
          teamsLink,
        ],
      }
    : teamsLink;

  // Projects are optional: an organisation that doesn't track time against
  // them has no use for either page.
  const projectManagementEntry: NavEntry = {
    kind: "group",
    label: "Project management",
    icon: Briefcase,
    children: [
      {
        kind: "link",
        label: "Projects",
        href: `/organisations/${organisationId}/projects`,
        icon: FolderSimple,
      },
      {
        kind: "link",
        label: "Tasks",
        href: `/organisations/${organisationId}/tasks`,
        icon: ListChecks,
      },
    ],
  };

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
    ...(projectsManageable ? [projectManagementEntry] : []),
    {
      kind: "group",
      label: "Reports",
      icon: ChartBar,
      children: [
        ...reportsFor(projectsEnabled).filter((report) => favouriteIds.includes(report.id)).map(
          (report): NavLink => ({
            kind: "link",
            label: report.title,
            href: `/organisations/${organisationId}/reports/${report.id}`,
            icon: Star,
          }),
        ),
        ...savedReports
          .filter((saved) => saved.id === openSavedReportId || favouriteIds.includes(saved.id))
          .map(
          (saved): NavLink => ({
            kind: "link",
            label: saved.name,
            href: `/organisations/${organisationId}/reports/saved/${saved.id}`,
            icon: BookmarkSimple,
          }),
        ),
        {
          kind: "link",
          label: "All reports",
          href: `/organisations/${organisationId}/reports/all`,
          icon: ListChecks,
        },
        {
          kind: "link",
          label: "Customised reports",
          href: `/organisations/${organisationId}/reports/customised`,
          icon: ListChecks,
        },
      ],
    },
    peopleEntry,
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
            kind: "group" as const,
            label: "Settings",
            icon: Gear,
            children: [
              // "All settings" first, so the card page listing every group
              // is always one click away from inside a section. `exact`
              // because its href is the parent of every section's — without
              // it, it would light up on all of them instead of the group
              // the section actually belongs to.
              {
                kind: "link" as const,
                label: "All settings",
                href: `/organisations/${organisationId}/settings`,
                icon: SquaresFour,
                exact: true,
              },
              ...SETTINGS_GROUPS.map((group) => ({
                kind: "link" as const,
                label: group.label,
                href: settingsHref(
                  organisationId,
                  group.key,
                  group.sections[0].key,
                ),
                // The link goes to the group's first section, but the group
                // owns all of them — so every section in it keeps this entry
                // highlighted, not just the one linked here.
                activePrefix: `/organisations/${organisationId}/settings/${group.key}`,
                icon: SETTINGS_GROUP_ICONS[group.key] ?? ChartLineUp,
              })),
            ],
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

      <nav className="hidden shrink-0 flex-col border-r border-primary-dark/10 bg-white sm:sticky sm:top-0 sm:flex sm:h-screen sm:w-16 lg:w-64">
        <div className="flex items-center justify-center gap-2 border-b border-primary-dark/10 px-2 py-4 lg:justify-start lg:px-5">
          {/* The mark carries the name on the icon-only rail; the wordmark
              beside it at lg repeats it, so it's decorative. */}
          <Image src="/brand/hiday-mark-sun.svg" alt="Hi Day" width={32} height={32} className="shrink-0" />
          <Image
            src="/brand/hiday-wordmark-ink.svg"
            alt=""
            width={58}
            height={24}
            className="hidden lg:block"
          />
        </div>
        <div className="flex flex-col gap-1 px-2 py-4 lg:px-3 lg:py-0">
          <SidebarNavEntries
            entries={entries}
            pathname={pathname}
            variant="rail"
          />
        </div>
      </nav>
    </>
  );
}
