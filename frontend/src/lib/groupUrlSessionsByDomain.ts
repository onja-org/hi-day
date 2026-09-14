import type { UrlSessionGroup } from "@/types/urlSession";

export type UrlSessionDomainGroup = {
  /** The host, with a leading "www." removed — what the accordion is labelled with. */
  domain: string;
  /** Summed focused time across every page on this domain, in ms. */
  totalActiveMs: number;
  /** The most recent visit to any page on this domain. */
  lastVisitedAt: string;
  /** Individual pages, most recently visited first. */
  pages: UrlSessionGroup[];
};

/**
 * Strips a leading "www." so "www.youtube.com" and "youtube.com" land in
 * the same accordion. Deliberately does NOT collapse other subdomains:
 * "mail.google.com" and "docs.google.com" stay separate, because they are
 * different sites to the person reading this, and merging them would need
 * a public-suffix list to do correctly rather than by guessing at dots.
 */
function toDomain(host: string): string {
  return host.replace(/^www\./i, "");
}

/**
 * Collapses a flat per-URL list into one entry per domain, so a page with
 * thirty GitHub URLs shows as one row that expands rather than thirty.
 *
 * Both the domains and the pages inside them are ordered by most recent
 * visit, matching the flat list's existing ordering so nothing appears to
 * jump around when a section is expanded.
 */
export function groupUrlSessionsByDomain(
  groups: UrlSessionGroup[],
): UrlSessionDomainGroup[] {
  const byDomain = new Map<string, UrlSessionDomainGroup>();

  for (const group of groups) {
    const domain = toDomain(group.host);
    const existing = byDomain.get(domain);

    if (!existing) {
      byDomain.set(domain, {
        domain,
        totalActiveMs: group.totalActiveMs,
        lastVisitedAt: group.lastVisitedAt,
        pages: [group],
      });
      continue;
    }

    existing.totalActiveMs += group.totalActiveMs;
    existing.pages.push(group);
    if (new Date(group.lastVisitedAt) > new Date(existing.lastVisitedAt)) {
      existing.lastVisitedAt = group.lastVisitedAt;
    }
  }

  const domains = Array.from(byDomain.values());
  for (const entry of domains) {
    entry.pages.sort(
      (a, b) =>
        new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime(),
    );
  }

  return domains.sort(
    (a, b) =>
      new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime(),
  );
}
