import type { Icon } from "@phosphor-icons/react";

export type NavLink = {
  kind: "link";
  label: string;
  href: string;
  icon: Icon;
  /** Highlight only on this exact path, never on pages nested under it —
   * for a link whose href is the parent of other links' hrefs, like
   * "All settings" sitting above every settings section. */
  exact?: boolean;
  /** Highlight anywhere under this path instead of under `href`, for a link
   * that points at one page but stands for a whole area — a settings group
   * links to its first section yet owns every section in the group. */
  activePrefix?: string;
};

/** An expandable section of the sidebar, e.g. "People" → Members, Teams. */
export type NavGroup = {
  kind: "group";
  label: string;
  icon: Icon;
  children: NavLink[];
};

export type NavEntry = NavLink | NavGroup;
