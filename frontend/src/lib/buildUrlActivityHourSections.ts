import { groupUrlSessionsByDomain } from "@/lib/groupUrlSessionsByDomain";
import type { UrlSessionDomainGroup } from "@/lib/groupUrlSessionsByDomain";
import type { UrlHourBucketPage, UrlSessionGroup } from "@/types/urlSession";

export type UrlActivityTableSection = {
  key: string;
  projectId: string | null;
  domain: UrlSessionDomainGroup;
};

/**
 * UrlSessionGroup's `lastVisitedAt` exists for sorting an all-time list;
 * within one hour bucket every page shares the same hour, so the bucket's
 * own hourStart stands in for it.
 */
function toSessionGroup(page: UrlHourBucketPage, hourStart: string): UrlSessionGroup {
  return {
    url: page.url,
    host: page.host,
    urlUnknown: page.urlUnknown,
    browser: page.browser,
    title: page.title,
    totalActiveMs: page.activeMs,
    lastVisitedAt: hourStart,
    sessionCount: page.sessionCount,
  };
}

/**
 * Splits one hour bucket's flat page list into one table row per
 * project+domain. Grouped by project first, then domain. The backend keys
 * its hour cells by (hour, project, url), so one URL legitimately appears
 * twice in a bucket when it was visited under two projects — or once
 * tracked and once not. Grouping the other way round would put both in the
 * same row, which collides React keys and lets one domain's project be
 * taken from whichever page happened to come first. This way each row
 * belongs to exactly one project, so the project cell is right by
 * construction and URLs are unique within it.
 *
 * Map iteration follows insertion order, and the backend already returns a
 * bucket's pages by descending active time — so the busiest project, and
 * the busiest domain within it, stay first.
 */
export function buildUrlActivityHourSections(
  pages: UrlHourBucketPage[],
  hourStart: string,
): UrlActivityTableSection[] {
  const byProject = new Map<string, UrlHourBucketPage[]>();
  for (const page of pages) {
    const key = page.projectId ?? "untracked";
    byProject.set(key, [...(byProject.get(key) ?? []), page]);
  }

  return Array.from(byProject.entries()).flatMap(([projectKey, projectPages]) =>
    groupUrlSessionsByDomain(projectPages.map((page) => toSessionGroup(page, hourStart))).map(
      (domain) => ({
        key: `${projectKey}|${domain.domain}`,
        projectId: projectPages[0]?.projectId ?? null,
        domain,
      }),
    ),
  );
}
