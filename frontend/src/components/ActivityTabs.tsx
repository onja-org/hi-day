"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type ActivityTabsProps = {
  organisationId: string;
};

export function ActivityTabs({ organisationId }: ActivityTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  const appsHref = `/organisations/${organisationId}/activities/apps`;
  const urlsHref = `/organisations/${organisationId}/activities/urls`;
  const screenshotsHref = `/organisations/${organisationId}/activities/screenshots`;
  const notesHref = `/organisations/${organisationId}/activities`;

  // Tracked-data tabs first, Notes last as the lighter annotation layer —
  // a one-line reorder, easy to revisit.
  const tabs = [
    { label: "Apps", href: appsHref },
    { label: "URLs", href: urlsHref },
    { label: "Screenshots", href: screenshotsHref },
    { label: "Notes", href: notesHref },
  ];

  return (
    <nav className="flex gap-1 border-b border-input-border">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        // Forwards the current day/member/project filters onto every tab
        // so switching tabs doesn't reset them — ActivityFilterToolbar
        // stores that state in the query string, not component state.
        const href = query ? `${tab.href}?${query}` : tab.href;
        return (
          <Link
            key={tab.href}
            href={href}
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
