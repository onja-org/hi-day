"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import clsx from "clsx";
import { isNavLinkActive } from "@/lib/isNavLinkActive";
import type { NavGroup } from "@/types/navigation";
import { SidebarNavLink } from "./SidebarNavLink";

type SidebarNavGroupProps = {
  group: NavGroup;
  pathname: string;
  variant: "rail" | "drawer";
  onNavigate?: () => void;
};

/** An expandable nav section, open while one of its pages is showing
 * (until toggled). On the icon-only rail (below lg) there's no room for a header
 * or labels, so its children show as plain icon links instead. */
export function SidebarNavGroup({ group, pathname, variant, onNavigate }: SidebarNavGroupProps) {
  const hasActiveChild = group.children.some((child) => isNavLinkActive(pathname, child.href));
  // Follows the current page until the user toggles it themselves — not a
  // one-off initial value, since a role-gated child (e.g. Members) only
  // appears once the caller's role has loaded.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const expanded = toggled ?? hasActiveChild;
  const isRail = variant === "rail";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setToggled(!expanded)}
        aria-expanded={expanded}
        className={clsx(
          "cursor-pointer items-center gap-3 rounded-r-md border-l-2 border-transparent px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 hover:bg-white",
          isRail && "hidden lg:flex lg:pl-4",
          !isRail && "flex",
          hasActiveChild && "text-primary",
          !hasActiveChild && "text-slate-900 hover:text-primary-dark",
        )}
      >
        <group.icon size={20} aria-hidden="true" className="shrink-0" />
        {/* min-w-0 lets a long label shrink instead of pushing the caret
            out of line with the other groups' carets. */}
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        <CaretDown
          size={14}
          aria-hidden="true"
          className={clsx("shrink-0 transition-transform duration-150", !expanded && "-rotate-90")}
        />
      </button>

      <div
        className={clsx(
          "flex-col gap-1",
          isRail && "flex",
          isRail && !expanded && "lg:hidden",
          !isRail && expanded && "flex",
          !isRail && !expanded && "hidden",
        )}
      >
        {group.children.map((child) => (
          <SidebarNavLink
            key={child.href}
            link={child}
            active={isNavLinkActive(pathname, child.href)}
            variant={variant}
            nested
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
