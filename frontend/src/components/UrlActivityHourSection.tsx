import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { buildUrlActivityHourSections } from "@/lib/buildUrlActivityHourSections";
import { formatHourLabel } from "@/lib/formatHourLabel";
import type { UrlHourBucket } from "@/types/urlSession";
import { TableBody } from "@/components/ui/table/TableBody";
import { ActivityHourSectionRow } from "@/components/ActivityHourSectionRow";
import { UrlActivityDomainRow } from "@/components/UrlActivityDomainRow";

type UrlActivityHourSectionProps = {
  organisationId: string;
  bucket: UrlHourBucket;
};

export function UrlActivityHourSection({
  organisationId,
  bucket,
}: UrlActivityHourSectionProps) {
  const projectsEnabled = useProjectsEnabled();
  const sections = buildUrlActivityHourSections(bucket.pages, bucket.hourStart);

  return (
    <TableBody>
      <ActivityHourSectionRow
        label={formatHourLabel(bucket.hourStart)}
        colSpan={projectsEnabled ? 3 : 2}
      />
      {sections.map((section) => (
        <UrlActivityDomainRow
          key={section.key}
          organisationId={organisationId}
          projectId={section.projectId}
          domain={section.domain}
        />
      ))}
    </TableBody>
  );
}
