import { groupUrlSessionsByDomain } from "@/lib/groupUrlSessionsByDomain";
import type { UrlHourBucket, UrlHourBucketPage, UrlSessionGroup } from "@/types/urlSession";
import { ProjectBadgeOrUntracked } from "./ProjectBadgeOrUntracked";
import { UrlSessionDomainAccordion } from "./UrlSessionDomainAccordion";

function formatHourLabel(hourStart: string): string {
  return new Date(hourStart).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * UrlSessionGroup's `lastVisitedAt` exists for sorting an all-time list;
 * within one hour bucket every page shares the same hour, so the bucket's
 * own hourStart stands in for it.
 */
function toSessionGroup(page: UrlHourBucketPage, hourStart: string): UrlSessionGroup {
  return {
    url: page.url,
    host: page.host,
    title: page.title,
    totalActiveMs: page.activeMs,
    lastVisitedAt: hourStart,
    sessionCount: page.sessionCount,
  };
}

type UrlActivityHourGroupProps = {
  organisationId: string;
  bucket: UrlHourBucket;
};

/**
 * One hour's URL activity, as a Project badge over a per-domain accordion.
 *
 * Grouped by project first, then domain. The backend keys its hour cells by
 * (hour, project, url), so one URL legitimately appears twice in a bucket when
 * it was visited under two projects — or once tracked and once not. Grouping
 * the other way round put both in the same accordion, which collided React
 * keys and let one domain's badge be taken from whichever page happened to
 * come first. This way each accordion belongs to exactly one project, so the
 * badge is right by construction and URLs are unique within it.
 */
export function UrlActivityHourGroup({ organisationId, bucket }: UrlActivityHourGroupProps) {
  const byProject = new Map<string, UrlHourBucketPage[]>();
  for (const page of bucket.pages) {
    const key = page.projectId ?? "untracked";
    byProject.set(key, [...(byProject.get(key) ?? []), page]);
  }

  // Map iteration follows insertion order, and the backend already returns a
  // bucket's pages by descending active time — so the busiest project, and the
  // busiest domain within it, stay first.
  const sections = Array.from(byProject.entries()).flatMap(([projectKey, pages]) =>
    groupUrlSessionsByDomain(pages.map((page) => toSessionGroup(page, bucket.hourStart))).map(
      (domain) => ({
        key: `${projectKey}|${domain.domain}`,
        projectId: pages[0]?.projectId ?? null,
        domain,
      }),
    ),
  );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-primary-dark">
        {formatHourLabel(bucket.hourStart)}
      </h3>
      <div className="flex flex-col gap-2">
        {sections.map((section) => (
          <div key={section.key} className="flex flex-col gap-1">
            <ProjectBadgeOrUntracked
              organisationId={organisationId}
              projectId={section.projectId}
            />
            <UrlSessionDomainAccordion group={section.domain} />
          </div>
        ))}
      </div>
    </div>
  );
}
