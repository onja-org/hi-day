"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ActivityTabsProps = {
  organisationId: string;
};

export function ActivityTabs({ organisationId }: ActivityTabsProps) {
  const pathname = usePathname();
  const notesHref = `/organisations/${organisationId}/activities`;
  const appsHref = `/organisations/${organisationId}/activities/apps`;
  const screenshotsHref = `/organisations/${organisationId}/activities/screenshots`;

  const tabs = [
    { label: "Notes", href: notesHref },
    { label: "Apps", href: appsHref },
    { label: "Screenshots", href: screenshotsHref },
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
