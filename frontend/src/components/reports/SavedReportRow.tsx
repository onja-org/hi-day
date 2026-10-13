"use client";

import { useState } from "react";
import Link from "next/link";
import { StarIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { ActionsMenu } from "@/components/ActionsMenu";
import { TableCell } from "@/components/ui/table/TableCell";
import { TableRow } from "@/components/ui/table/TableRow";
import { nextScheduledRun } from "@/lib/nextScheduledRun";
import { savedReportTypeTitle } from "@/lib/savedReportTypeTitle";
import { summariseSchedule } from "@/lib/summariseSchedule";
import type { ReportSchedule } from "@/types/reportSchedule";
import type { SavedReport } from "@/types/savedReport";
import { ScheduleReportDialog } from "./ScheduleReportDialog";

type SavedReportRowProps = {
  report: SavedReport;
  href: string;
  /** The organisation's zone, which the schedule's delivery hour is read in. */
  zone: string;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onSaveSchedule: (report: SavedReport, input: { name: string; schedule: ReportSchedule }) => Promise<string | void>;
  onTogglePaused: () => void;
  onDelete: () => void;
};

function formatRun(date: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
    .format(date)
    .replace(/\s?(AM|PM)$/, (_, meridiem: string) => ` ${meridiem.toLowerCase()}`);
}

export function SavedReportRow({
  report,
  href,
  zone,
  isFavourite,
  onToggleFavourite,
  onSaveSchedule,
  onTogglePaused,
  onDelete,
}: SavedReportRowProps) {
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const { schedule } = report;
  const nextRun = schedule && !report.schedulePaused ? nextScheduledRun(schedule, new Date(), zone) : null;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleFavourite}
            aria-pressed={isFavourite}
            aria-label={isFavourite ? `Remove ${report.name} from favourites` : `Add ${report.name} to favourites`}
            className="cursor-pointer rounded-md p-0.5 hover:bg-primary/10"
          >
            <StarIcon
              size={16}
              aria-hidden="true"
              weight={isFavourite ? "fill" : "regular"}
              className={clsx(isFavourite && "text-primary", !isFavourite && "text-icon")}
            />
          </button>
          <Link href={href} className="font-medium text-primary hover:underline">
            {report.name}
          </Link>
        </div>
      </TableCell>
      <TableCell>{savedReportTypeTitle(report.reportType)}</TableCell>
      <TableCell>{new Date(report.modifiedAt).toLocaleString()}</TableCell>
      <TableCell>
        {schedule ? (
          <>
            <p className="font-medium">{summariseSchedule(schedule)}</p>
            {nextRun && <p className="text-xs text-slate-900/70">Next: {formatRun(nextRun, zone)}</p>}
          </>
        ) : (
          "-"
        )}
      </TableCell>
      <TableCell>
        {schedule && (
          <span
            title={report.lastError ?? (report.lastSentAt ? `Last sent ${new Date(report.lastSentAt).toLocaleString()}` : undefined)}
            className={clsx(
              "rounded-md px-2 py-1 text-xs font-medium",
              report.lastError && "bg-error/10 text-error",
              !report.lastError && report.schedulePaused && "bg-cream text-secondary",
              !report.lastError && !report.schedulePaused && "bg-success/10 text-success",
            )}
          >
            {report.lastError ? "Failed" : report.schedulePaused ? "Paused" : "Active"}
          </span>
        )}
        {!schedule && "-"}
      </TableCell>
      <TableCell align="right">
        <ActionsMenu
          items={[
            { label: "Edit report", href },
            { label: schedule ? "Edit schedule" : "Add schedule", onSelect: () => setIsEditingSchedule(true) },
            ...(schedule
              ? [{ label: report.schedulePaused ? "Resume delivery" : "Pause delivery", onSelect: onTogglePaused }]
              : []),
            { label: "Delete", tone: "danger" as const, onSelect: onDelete },
          ]}
        />
      </TableCell>
      {isEditingSchedule && (
        <ScheduleReportDialog
          initialName={report.name}
          initialSchedule={schedule ?? undefined}
          onPersist={(input) => onSaveSchedule(report, input)}
          onClose={() => setIsEditingSchedule(false)}
        />
      )}
    </TableRow>
  );
}
