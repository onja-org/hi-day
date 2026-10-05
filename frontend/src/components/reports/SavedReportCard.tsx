"use client";

import Link from "next/link";
import { ClockIcon, StarIcon, TrashIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { describeSchedule } from "@/lib/describeSchedule";
import type { SavedReport } from "@/types/savedReport";

type SavedReportCardProps = {
  report: SavedReport;
  href: string;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onDelete: () => void;
};

export function SavedReportCard({ report, href, isFavourite, onToggleFavourite, onDelete }: SavedReportCardProps) {
  return (
    <article className="relative flex h-full flex-col gap-4 rounded-lg border border-input-border bg-white p-4 transition-colors focus-within:border-primary hover:border-primary">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary-dark">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {report.name}
          </Link>
        </h3>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
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
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${report.name}`}
            className="cursor-pointer rounded-md p-0.5 text-icon hover:bg-primary/10"
          >
            <TrashIcon size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-primary-dark/5 px-2 py-1 text-xs text-slate-900">Time &amp; activity</span>
        {report.schedule && (
          <span
            title={describeSchedule(report.schedule)}
            className="flex rounded-md bg-primary/10 p-1.5 text-primary"
          >
            <ClockIcon size={16} aria-hidden="true" />
            <span className="sr-only">Scheduled: {describeSchedule(report.schedule)}</span>
          </span>
        )}
      </div>
    </article>
  );
}
