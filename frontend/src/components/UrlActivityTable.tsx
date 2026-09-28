import type { UrlHourBucket } from "@/types/urlSession";
import { UrlActivityHourSection } from "./UrlActivityHourSection";

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
export function UrlActivityTable({ organisationId, buckets }: UrlActivityTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-input-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-slate-900">
            <th className="px-3 py-3 font-medium">Project</th>
            <th className="px-3 py-3 font-medium">Site</th>
            <th className="px-3 py-3 text-right font-medium">Time spent</th>
          </tr>
        </thead>
        {buckets.map((bucket) => (
          <UrlActivityHourSection
            key={bucket.hourStart}
            organisationId={organisationId}
            bucket={bucket}
          />
        ))}
      </table>
    </div>
  );
}
