import type { Icon } from "@phosphor-icons/react";

export type NavLink = {
  kind: "link";
  label: string;
  href: string;
  icon: Icon;
};

/** An expandable section of the sidebar, e.g. "People" → Members, Teams. */
export type NavGroup = {
  kind: "group";
  label: string;
  icon: Icon;
  children: NavLink[];
};

export type NavEntry = NavLink | NavGroup;
