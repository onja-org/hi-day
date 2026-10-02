import clsx from "clsx";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

type ReportsTableFooterProps = {
  totalRows: number;
  perPage: number;
  onPerPageChange: (perPage: number) => void;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function ReportsTableFooter({
  totalRows,
  perPage,
  onPerPageChange,
  page,
  pageCount,
  onPageChange,
}: ReportsTableFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-input-border p-3 text-xs text-slate-900/70">
      <div className="flex items-center gap-2">
        <span>Showing {totalRows} rows</span>
        <select
          value={perPage}
          onChange={(event) => onPerPageChange(Number(event.target.value))}
          aria-label="Rows per page"
          className="rounded-full border border-input-border bg-white px-2 py-1 text-slate-900"
        >
          {PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span>per page</span>
      </div>
      <nav aria-label="Pagination" className="flex gap-1">
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onPageChange(number)}
            aria-current={number === page ? "page" : undefined}
            className={clsx(
              "cursor-pointer border-b-2 px-3 py-1",
              number === page && "border-primary text-primary",
              number !== page && "border-transparent hover:text-primary-dark",
            )}
          >
            {number}
          </button>
        ))}
      </nav>
    </div>
  );
}
