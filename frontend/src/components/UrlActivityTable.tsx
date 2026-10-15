import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import type { UrlHourBucket } from "@/types/urlSession";
import { ActivityBucketTable } from "@/components/ActivityBucketTable";
import { UrlActivityHourSection } from "@/components/UrlActivityHourSection";

type UrlActivityTableProps = {
  organisationId: string;
  buckets: UrlHourBucket[];
};

/**
 * The Activities → URLs tab, laid out as a table (Hubstaff's URLs view is
 * the layout reference): a Project/Site/Time spent header, one section per
 * hour bucket, and one row per project+domain within it — each row
 * expandable into the individual tracked pages on that domain.
 */
export function UrlActivityTable({
  organisationId,
  buckets,
}: UrlActivityTableProps) {
  const projectsEnabled = useProjectsEnabled();

  return (
    <ActivityBucketTable
      columns={[
        ...(projectsEnabled ? [{ label: "Project" }] : []),
        { label: "Site" },
        { label: "Time spent", align: "right" },
      ]}
      buckets={buckets}
      renderSection={(bucket) => (
        <UrlActivityHourSection
          organisationId={organisationId}
          bucket={bucket}
        />
      )}
    />
  );
}
