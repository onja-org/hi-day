import { format } from "date-fns";
import { TIME_ACTIVITY_GROUPINGS } from "@/lib/timeActivityReportConfig";
import type { DateRange } from "@/types/dateRange";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";

type TimeActivityReportSettingsProps = {
  range: DateRange;
  showsEveryone: boolean;
  grouping: TimeActivityGrouping;
  filterCount: number;
};

/** The report's current settings, as listed in the save-report modal. */
export function TimeActivityReportSettings({
  range,
  showsEveryone,
  grouping,
  filterCount,
}: TimeActivityReportSettingsProps) {
  return (
    <ul className="flex flex-col gap-1">
      <li>
        Date range: {format(range.from, "MMM d, yyyy")} – {format(range.to, "MMM d, yyyy")}
      </li>
      <li>Show: {showsEveryone ? "Everyone" : "Me"}</li>
      <li>
        Data grouped by: {TIME_ACTIVITY_GROUPINGS.find((option) => option.value === grouping)?.label}
      </li>
      <li>Filters applied: {filterCount}</li>
    </ul>
  );
}
