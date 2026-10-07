"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  activeSettingsLocation,
  settingsHref,
  SETTINGS_GROUPS,
} from "@/lib/settingsNavigation";
import { useSettingsDirty } from "@/components/SettingsDirtyProvider";

type SettingsNavProps = {
  organisationId: string;
  /** The section panel, which sits under its group's tabs. */
  children: React.ReactNode;
};

/** The Settings groups down the left, and the active group's sections as
 * tabs above the panel. */
export function SettingsNav({ organisationId, children }: SettingsNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { confirmLeave } = useSettingsDirty();
  const active = activeSettingsLocation(pathname ?? "");
  const activeGroup =
    SETTINGS_GROUPS.find((group) => group.key === active?.groupKey) ??
    SETTINGS_GROUPS[0];

  function navigate(href: string) {
    return (event: React.MouseEvent) => {
      event.preventDefault();
      if (confirmLeave()) router.push(href);
    };
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-8">
      <nav aria-label="Settings groups" className="md:w-56 md:shrink-0">
        <ul className="flex gap-1 md:flex-col">
          {SETTINGS_GROUPS.map((group) => {
            const href = settingsHref(
              organisationId,
              group.key,
              group.sections[0].key,
            );
            const isActive = group.key === activeGroup.key;
            return (
              <li key={group.key}>
                <Link
                  href={href}
                  onClick={navigate(href)}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "block rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                    isActive && "bg-white text-primary",
                    !isActive && "text-slate-900 hover:text-primary-dark",
                  )}
                >
                  {group.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        <nav aria-label={`${activeGroup.label} sections`}>
          <ul className="flex gap-1 overflow-x-auto border-b border-input-border">
            {activeGroup.sections.map((section) => {
              const href = settingsHref(
                organisationId,
                activeGroup.key,
                section.key,
              );
              const isActive = section.key === active?.sectionKey;
              return (
                <li key={section.key}>
                  <Link
                    href={href}
                    onClick={navigate(href)}
                    aria-current={isActive ? "page" : undefined}
                    className={clsx(
                      "-mb-px block border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150",
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
        {children}
      </div>
    </div>
  );
}
