import { isNavLinkActive } from "@/lib/isNavLinkActive";
import type { NavEntry } from "@/types/navigation";
import { SidebarNavGroup } from "./SidebarNavGroup";
import { SidebarNavLink } from "./SidebarNavLink";

type SidebarNavEntriesProps = {
  entries: NavEntry[];
  pathname: string;
  variant: "rail" | "drawer";
  onNavigate?: () => void;
};

export function SidebarNavEntries({ entries, pathname, variant, onNavigate }: SidebarNavEntriesProps) {
  return (
    <>
      {entries.map((entry) =>
        entry.kind === "group" ? (
          <SidebarNavGroup
            key={entry.label}
            group={entry}
            pathname={pathname}
            variant={variant}
            onNavigate={onNavigate}
          />
        ) : (
          <SidebarNavLink
            key={entry.href}
            link={entry}
            active={isNavLinkActive(pathname, entry)}
            variant={variant}
            onNavigate={onNavigate}
          />
        ),
      )}
    </>
  );
}
