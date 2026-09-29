/** A nav link is active on its own page and on any page nested under it,
 * e.g. Teams stays highlighted on a single team's page. */
export function isNavLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
