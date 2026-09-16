import { groupUrlSessionsByDomain } from "@/lib/groupUrlSessionsByDomain";
import type { UrlHourBucket, UrlSessionGroup } from "@/types/urlSession";
import { ProjectBadgeOrUntracked } from "./ProjectBadgeOrUntracked";
import { UrlSessionDomainAccordion } from "./UrlSessionDomainAccordion";

function formatHourLabel(hourStart: string): string {
  return new Date(hourStart).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

type UrlActivityHourGroupProps = {
  organisationId: string;
  bucket: UrlHourBucket;
};

/** One hour's URL-activity accordion list — bold hour header, a Project
 * badge per domain (from that domain's first page's covering entry — a
 * domain rarely spans two projects within one hour), then the existing
 * per-domain accordion reused as-is. */
export function UrlActivityHourGroup({ organisationId, bucket }: UrlActivityHourGroupProps) {
  // UrlSessionGroup's `lastVisitedAt` exists for sorting within an
  // all-time list; within one hour bucket every page shares the same hour,
  // so the bucket's own hourStart stands in for it here.
  const groups: UrlSessionGroup[] = bucket.pages.map((page) => ({
    url: page.url,
    host: page.host,
    title: page.title,
    totalActiveMs: page.activeMs,
    lastVisitedAt: bucket.hourStart,
    sessionCount: page.sessionCount,
  }));
  const domains = groupUrlSessionsByDomain(groups);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-primary-dark">
        {formatHourLabel(bucket.hourStart)}
      </h3>
      <div className="flex flex-col gap-2">
        {domains.map((domain) => {
          const firstPage = bucket.pages.find((page) => page.url === domain.pages[0]?.url);
          return (
            <div key={domain.domain} className="flex flex-col gap-1">
              <ProjectBadgeOrUntracked
                organisationId={organisationId}
                projectId={firstPage?.projectId ?? null}
              />
              <UrlSessionDomainAccordion group={domain} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
