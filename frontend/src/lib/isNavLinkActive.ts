import type { NavLink } from "@/types/navigation";

/** What decides whether a nav link is highlighted: its own href by default,
 * narrowed by `exact` or widened by `activePrefix`. */
type ActiveMatch = Pick<NavLink, "href" | "exact" | "activePrefix">;

/**
 * A nav link is active on its own page and on any page nested under it, e.g.
 * Teams stays highlighted on a single team's page.
 *
 * Two links need something else. One whose href is an ancestor of its
 * siblings' ("All settings" above every settings section) sets `exact`, or
 * it would stay lit on all of them. One that points at a page but stands for
 * a whole area (a settings group linking to its first section) sets
 * `activePrefix` to that area, or it would go dark on every other section.
 */
export function isNavLinkActive(pathname: string, link: ActiveMatch): boolean {
  if (link.exact) {
    return pathname === link.href;
  }
  const base = link.activePrefix ?? link.href;
  return pathname === base || pathname.startsWith(`${base}/`);
}
