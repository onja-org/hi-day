import { AppWindowIcon } from "@phosphor-icons/react";
import { formatElapsed } from "@/lib/formatElapsed";
import { formatHourLabel } from "@/lib/formatHourLabel";
import type { AppHourBucket } from "@/types/appActivity";
import { ActivityHourSectionRow } from "@/components/ActivityHourSectionRow";
import { ProjectNameOrUntracked } from "@/components/ProjectNameOrUntracked";
import { TableBody } from "@/components/ui/table/TableBody";
import { TableRow } from "@/components/ui/table/TableRow";
import { TableCell } from "@/components/ui/table/TableCell";

type AppActivityHourSectionProps = {
  organisationId: string;
  bucket: AppHourBucket;
};

export function AppActivityHourSection({
  organisationId,
  bucket,
}: AppActivityHourSectionProps) {
  return (
    <TableBody>
      <ActivityHourSectionRow
        label={formatHourLabel(bucket.hourStart)}
        colSpan={4}
      />
      {bucket.items.map((item, index) => (
        <TableRow
          key={`${item.projectId ?? "untracked"}-${item.appName}-${index}`}
        >
          <TableCell>
            <ProjectNameOrUntracked
              organisationId={organisationId}
              projectId={item.projectId}
            />
          </TableCell>
          <TableCell>
            <span className="flex items-center gap-2">
              <AppWindowIcon
                size={16}
                className="shrink-0 text-primary-dark"
                aria-hidden="true"
              />
              <span className="truncate">{item.appName}</span>
            </span>
          </TableCell>
          <TableCell align="right">
            {formatElapsed(item.secondsSpent * 1000)}
          </TableCell>
          <TableCell align="right">{item.sessionCount}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}
