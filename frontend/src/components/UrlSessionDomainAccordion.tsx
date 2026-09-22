"use client";

import { CaretRightIcon, TrashIcon } from "@phosphor-icons/react";
import { formatElapsed } from "@/lib/formatElapsed";
import type { UrlSessionDomainGroup } from "@/lib/groupUrlSessionsByDomain";

type UrlSessionDomainAccordionProps = {
  group: UrlSessionDomainGroup;
  /** Omitted on the read-only views — only a member's own detail page can delete. */
  onDelete?: (url: string) => void;
  isDeleting?: boolean;
  /** Caps how many pages (most recently visited first) render when expanded — the dashboard's compact preview. Omit to show every tracked page. */
  maxPages?: number;
};

/**
 * One expandable domain. Built on native `<details>`/`<summary>` rather
 * than a hand-rolled toggle: keyboard operation, focus handling and the
 * expanded/collapsed state come for free and correctly, with no state to
 * manage here.
 */
export function UrlSessionDomainAccordion({
  group,
  onDelete,
  isDeleting = false,
  maxPages,
}: UrlSessionDomainAccordionProps) {
  const pageLabel = group.pages.length === 1 ? "page" : "pages";
  const visiblePages = maxPages ? group.pages.slice(0, maxPages) : group.pages;

  return (
    <details className="group rounded-md border border-input-border">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 transition-colors duration-150 hover:bg-cream">
        <CaretRightIcon
          size={16}
          aria-hidden="true"
          className="shrink-0 text-icon transition-transform duration-150 group-open:rotate-90"
        />
        <span className="min-w-0 flex-1 truncate font-medium text-primary-dark">
          {group.domain}
        </span>
        <span className="shrink-0 text-sm text-slate-900/70">
          {group.pages.length} {pageLabel}
        </span>
        <span className="shrink-0 text-sm font-medium tabular-nums text-primary-dark">
          {formatElapsed(group.totalActiveMs)}
        </span>
      </summary>

      <ul className="flex flex-col border-t border-input-border">
        {visiblePages.map((page) => (
          <li
            key={page.url}
            className="flex items-center justify-between gap-3 border-b border-input-border px-3 py-2 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <a
                href={page.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary underline-offset-2 hover:underline"
              >
                {page.url}
              </a>
              <span className="text-sm text-slate-900/70">
                Time Spent {formatElapsed(page.totalActiveMs)}
              </span>
            </div>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(page.url)}
                disabled={isDeleting}
                aria-label={`Delete tracked activity for ${page.url}`}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-input-border px-3 py-1.5 text-sm text-slate-900 transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
              >
                <TrashIcon size={16} aria-hidden="true" />
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
