"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BuildingsIcon, ChartLineUpIcon, UsersIcon } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import clsx from "clsx";
import {
  activeSettingsLocation,
  settingsHref,
  SETTINGS_GROUPS,
} from "@/lib/settingsNavigation";

type SettingsHeaderProps = {
  organisationId: string;
};

const GROUP_ICONS: Record<string, Icon> = {
  organization: BuildingsIcon,
  members: UsersIcon,
  tracking: ChartLineUpIcon,
};

/**
 * Names where you are: the area on the card page, and inside a group, the
 * group plus its sections as tabs.
 */
export function SettingsHeader({ organisationId }: SettingsHeaderProps) {
  const pathname = usePathname();
  const active = activeSettingsLocation(pathname ?? "");

  if (!active) {
    return (
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-primary-dark">Settings</h1>
        <p className="text-sm text-slate-900/60">
          Company details and how the desktop agent tracks time for your team.
        </p>
      </header>
    );
  }

  const group = SETTINGS_GROUPS.find((candidate) => candidate.key === active.groupKey);
  if (!group) return null;
  const GroupIcon = GROUP_ICONS[group.key];

  return (
    <header className="mb-6 flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-primary-dark">
        {GroupIcon && <GroupIcon size={24} weight="bold" aria-hidden="true" className="text-primary" />}
        {group.label}
      </h1>

      <nav aria-label={`${group.label} sections`}>
        <ul className="flex flex-wrap gap-1 border-b-2 border-input-border">
          {group.sections.map((section) => {
            const isActive = section.key === active.sectionKey;
            return (
              <li key={section.key}>
                <Link
                  href={settingsHref(organisationId, group.key, section.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "-mb-0.5 block border-b-2 px-4 py-2 text-sm font-semibold tracking-wide whitespace-nowrap uppercase transition-colors duration-150",
                    isActive && "border-primary text-primary",
                    !isActive &&
                      "border-transparent text-slate-900 hover:text-primary-dark",
                  )}
                >
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
