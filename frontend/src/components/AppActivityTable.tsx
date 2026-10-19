import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import type { AppHourBucket } from "@/types/appActivity";
import { ActivityBucketTable } from "@/components/ActivityBucketTable";
import { AppActivityHourSection } from "@/components/AppActivityHourSection";

type AppActivityTableProps = {
  organisationId: string;
  buckets: AppHourBucket[];
};

/**
 * The Activities → Apps tab, laid out as a table — same shell as
 * `UrlActivityTable` (Hubstaff's hourly grouping, this app's own table
 * styling), with one row per project+app within each hour bucket.
 */
export function AppActivityTable({
  organisationId,
  buckets,
}: AppActivityTableProps) {
  const projectsEnabled = useProjectsEnabled();

  return (
    <ActivityBucketTable
      columns={[
        ...(projectsEnabled ? [{ label: "Project" }] : []),
        { label: "App" },
        { label: "Time spent", align: "right" },
        { label: "Sessions", align: "right" },
      ]}
      buckets={buckets}
      renderSection={(bucket) => (
        <AppActivityHourSection
          organisationId={organisationId}
          bucket={bucket}
        />
      )}
    />
  );
}
