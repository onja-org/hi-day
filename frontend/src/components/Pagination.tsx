"use client";

import clsx from "clsx";
import {
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { buildPageList } from "@/lib/buildPageList";
import { describePageRange } from "@/lib/describePageRange";
import { getPageCount } from "@/lib/getPageCount";

type PaginationProps = {
  /** Names the pager for screen readers, e.g. "Screenshot pages". */
  label: string;
  page: number;
  pageSize: number;
  total: number;
  /** True while the next page is on its way — the buttons wait for it. */
  isFetching?: boolean;
  onPageChange: (page: number) => void;
};

/**
 * First/previous/next/last around a windowed row of page numbers — a long
 * list runs to dozens of pages, more than a row of every number can hold.
 * Phones get "Page x of y" in place of the row. Renders nothing for a
 * single page.
 */
export function Pagination({
  label,
  page,
  pageSize,
  total,
  isFetching = false,
  onPageChange,
}: PaginationProps) {
  const pageCount = getPageCount(total, pageSize);
  if (pageCount <= 1) return null;

  const isFirst = page <= 1;
  const isLast = page >= pageCount;
  const goTo = (target: number) => {
    if (target !== page) onPageChange(target);
  };

  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p aria-live="polite" className="text-sm text-slate-900/70">
        {describePageRange(page, pageSize, total)}
      </p>
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          aria-label="First page"
          onClick={() => goTo(1)}
          disabled={isFirst || isFetching}
          className="cursor-pointer rounded-brand-sm border-2 border-ink p-1.5 font-semibold text-slate-900 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CaretDoubleLeftIcon size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => goTo(page - 1)}
          disabled={isFirst || isFetching}
          className="cursor-pointer rounded-brand-sm border-2 border-ink p-1.5 font-semibold text-slate-900 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CaretLeftIcon size={16} aria-hidden="true" />
        </button>

        <span className="min-w-24 text-center text-sm font-medium text-slate-900 sm:hidden">
          Page {page} of {pageCount}
        </span>
        <ul className="hidden items-center gap-1 sm:flex">
          {buildPageList(page, pageCount).map((item, index) =>
            item === "gap" ? (
              <li
                key={`gap-${index}`}
                aria-hidden="true"
                className="min-w-8 text-center text-sm text-slate-900/60"
              >
                …
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                  onClick={() => goTo(item)}
                  disabled={isFetching}
                  className={clsx(
                    "h-8 min-w-8 cursor-pointer rounded-brand-sm border-2 px-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                    item === page && "border-ink bg-primary text-white",
                    item !== page && "border-transparent text-slate-900 hover:bg-cream",
                  )}
                >
                  {item}
                </button>
              </li>
            ),
          )}
        </ul>

        <button
          type="button"
          aria-label="Next page"
          onClick={() => goTo(page + 1)}
          disabled={isLast || isFetching}
          className="cursor-pointer rounded-brand-sm border-2 border-ink p-1.5 font-semibold text-slate-900 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CaretRightIcon size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Last page"
          onClick={() => goTo(pageCount)}
          disabled={isLast || isFetching}
          className="cursor-pointer rounded-brand-sm border-2 border-ink p-1.5 font-semibold text-slate-900 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CaretDoubleRightIcon size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
