"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretLeftIcon } from "@phosphor-icons/react";
import { activeSettingsLocation, SETTINGS_GROUPS } from "@/lib/settingsNavigation";
import { useSettingsDirty } from "@/components/SettingsDirtyProvider";

type SettingsHeaderProps = {
  organisationId: string;
};

/** Names where you are: the area on the card page, the section inside one. */
export function SettingsHeader({ organisationId }: SettingsHeaderProps) {
  const pathname = usePathname();
  const { confirmLeave } = useSettingsDirty();
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
  const section = group?.sections.find((candidate) => candidate.key === active.sectionKey);

  return (
    <header className="mb-6 flex flex-col gap-2">
      <Link
        href={`/organisations/${organisationId}/settings`}
        // Asks before leaving, same as any other way out of a dirty section.
        onClick={(event) => {
          if (!confirmLeave()) event.preventDefault();
        }}
        className="flex w-fit items-center gap-1 text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-dark"
      >
        <CaretLeftIcon size={14} weight="bold" aria-hidden="true" />
        All settings
      </Link>

      <h1 className="text-2xl font-semibold text-primary-dark">
        {section?.label ?? "Settings"}
      </h1>
      {group && <p className="text-sm text-slate-900/60">{group.label}</p>}
    </header>
  );
}
