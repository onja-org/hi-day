import clsx from "clsx";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { condensePageNumbers } from "@/lib/condensePageNumbers";

const DEFAULT_PER_PAGE_OPTIONS = [10, 25, 50, 100];

type ReportsTableFooterProps = {
  totalRows: number;
  perPage: number;
  perPageOptions?: number[];
  onPerPageChange: (perPage: number) => void;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onShowAll?: () => void;
  allSelected?: boolean;
  /** Adds Previous/Next buttons, and on mobile swaps the page numbers for "Page X of Y". */
  showPrevNext?: boolean;
  /** Shows only the first, last and nearby page numbers, with "…" between. */
  condensePages?: boolean;
};

export function ReportsTableFooter({
  totalRows,
  perPage,
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
  onPerPageChange,
  page,
  pageCount,
  onPageChange,
  onShowAll,
  allSelected = false,
  showPrevNext = false,
  condensePages = false,
}: ReportsTableFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-input-border p-3 text-xs text-slate-900/70">
      <div className="flex items-center gap-2">
        <span>Showing {totalRows} rows</span>
        <select
          value={allSelected ? "all" : perPage}
          onChange={(event) => onPerPageChange(Number(event.target.value))}
          aria-label="Rows per page"
          className="rounded-full border-2 border-ink bg-white px-2 py-1 text-slate-900"
        >
          {allSelected && <option value="all">All</option>}
          {perPageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span>per page</span>
      </div>
      <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
        {showPrevNext && (
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || allSelected}
            aria-label="Previous page"
            className="cursor-pointer px-2 py-1 hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CaretLeftIcon size={16} aria-hidden="true" />
          </button>
        )}
        {showPrevNext && (
          <span className="px-2 sm:hidden">
            Page {page} of {pageCount}
          </span>
        )}
        {(condensePages
          ? condensePageNumbers(page, pageCount)
          : Array.from({ length: pageCount }, (_, index) => index + 1)
        ).map((number, index) => number === "gap" ? (
          <span
            key={`gap-${index}`}
            aria-hidden="true"
            className={clsx("px-2 py-1", showPrevNext && "hidden sm:inline-block")}
          >
            …
          </span>
        ) : (
          <button
            key={number}
            type="button"
            onClick={() => onPageChange(number)}
            aria-current={number === page && !allSelected ? "page" : undefined}
            className={clsx(
              "cursor-pointer border-b-2 px-3 py-1",
              showPrevNext && "hidden sm:inline-block",
              number === page && !allSelected && "border-primary text-primary",
              (number !== page || allSelected) && "border-transparent hover:text-primary-dark",
            )}
          >
            {number}
          </button>
        ))}
        {showPrevNext && (
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount || allSelected}
            aria-label="Next page"
            className="cursor-pointer px-2 py-1 hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CaretRightIcon size={16} aria-hidden="true" />
          </button>
        )}
        {onShowAll && (
          <button
            type="button"
            onClick={onShowAll}
            aria-pressed={allSelected}
            className={clsx(
              "cursor-pointer border-b-2 px-3 py-1",
              allSelected && "border-primary text-primary",
              !allSelected && "border-transparent hover:text-primary-dark",
            )}
          >
            Show all
          </button>
        )}
      </nav>
    </div>
  );
}
