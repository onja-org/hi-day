import { buildUrlActivityHourSections } from "@/lib/buildUrlActivityHourSections";
import { formatHourLabel } from "@/lib/formatHourLabel";
import type { UrlHourBucket } from "@/types/urlSession";
import { UrlActivityDomainRow } from "./UrlActivityDomainRow";

type UrlActivityHourSectionProps = {
  organisationId: string;
  bucket: UrlHourBucket;
};

/** One hour's worth of rows in the URLs table, headed by the hour label —
 * extracted out of `UrlActivityTable` to keep that file under the
 * components size guideline. */
export function UrlActivityHourSection({ organisationId, bucket }: UrlActivityHourSectionProps) {
  const sections = buildUrlActivityHourSections(bucket.pages, bucket.hourStart);

  return (
    <tbody>
      <tr className="border-t border-b border-input-border">
        <th
          colSpan={3}
          scope="colgroup"
          className="px-3 py-3 text-left text-sm font-semibold tracking-wide text-primary-dark uppercase"
        >
          {formatHourLabel(bucket.hourStart)}
        </th>
      </tr>
      {sections.map((section) => (
        <UrlActivityDomainRow
          key={section.key}
          organisationId={organisationId}
          projectId={section.projectId}
          domain={section.domain}
        />
      ))}
    </tbody>
  );
}
