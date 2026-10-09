import Link from "next/link";
import {
  BuildingsIcon,
  ChartLineUpIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { settingsHref, SETTINGS_GROUPS } from "@/lib/settingsNavigation";

type SettingsCardsProps = {
  organisationId: string;
};

/** One per group, keyed so the nav tree stays free of components. */
const GROUP_ICONS: Record<string, Icon> = {
  organization: BuildingsIcon,
  members: UsersIcon,
  tracking: ChartLineUpIcon,
};

/** Every settings group as a card of links — the whole area at a glance,
 * rather than a nav someone has to open to find out what is in it. */
export function SettingsCards({ organisationId }: SettingsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {SETTINGS_GROUPS.map((group) => {
        const GroupIcon = GROUP_ICONS[group.key];
        return (
          <section
            key={group.key}
            className="flex flex-col gap-4 rounded-brand-sm border-2 border-ink bg-white p-5"
          >
            <h2 className="flex items-center gap-2 text-base font-semibold text-primary-dark">
              {GroupIcon && (
                <GroupIcon size={20} weight="bold" aria-hidden="true" className="text-primary" />
              )}
              {group.label}
            </h2>

            <ul className="flex flex-col gap-1">
              {group.sections.map((section) => (
                <li key={section.key}>
                  <Link
                    href={settingsHref(organisationId, group.key, section.key)}
                    className="block rounded-brand-sm px-2 py-1.5 text-sm text-primary transition-colors duration-150 hover:bg-cream"
                  >
                    {section.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
