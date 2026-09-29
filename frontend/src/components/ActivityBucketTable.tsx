import { Fragment, type ReactNode } from "react";
import {
  ActivityTable,
  type ActivityTableColumn,
} from "@/components/ActivityTable";

type ActivityBucketTableProps<TBucket extends { hourStart: string }> = {
  columns: ActivityTableColumn[];
  buckets: TBucket[];
  /** Renders one bucket's `<tbody>` section — the only tab-specific part
   * left once the table shell and the bucket-to-section mapping are
   * shared. */
  renderSection: (bucket: TBucket) => ReactNode;
};

/**
 * Maps a day's hour buckets onto an `ActivityTable`, one `<tbody>` section
 * per bucket — the part every Activity tab's table (`UrlActivityTable`,
 * `AppActivityTable`, …) repeated identically. Only the columns and how to
 * render one bucket's rows differ per tab, so those are the only things
 * callers still supply.
 */
export function ActivityBucketTable<TBucket extends { hourStart: string }>({
  columns,
  buckets,
  renderSection,
}: ActivityBucketTableProps<TBucket>) {
  return (
    <ActivityTable columns={columns}>
      {buckets.map((bucket) => (
        <Fragment key={bucket.hourStart}>{renderSection(bucket)}</Fragment>
      ))}
    </ActivityTable>
  );
}
