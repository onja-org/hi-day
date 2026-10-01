"use client";

import clsx from "clsx";
import type { ReportScope } from "@/types/reportScope";

const SCOPE_LABELS: Record<ReportScope, string> = {
  me: "Me",
  all: "All",
};

type ReportScopeTabsProps = {
  value: ReportScope;
  onChange: (scope: ReportScope) => void;
};

export function ReportScopeTabs({ value, onChange }: ReportScopeTabsProps) {
  return (
    <nav role="tablist" aria-label="Report scope" className="flex gap-1 border-b border-input-border">
      {(Object.keys(SCOPE_LABELS) as ReportScope[]).map((scope) => (
        <button
          key={scope}
          type="button"
          role="tab"
          aria-selected={value === scope}
          onClick={() => onChange(scope)}
          className={clsx(
            "cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
            value === scope && "border-primary text-primary",
            value !== scope && "border-transparent text-slate-900 hover:text-primary-dark",
          )}
        >
          {SCOPE_LABELS[scope]}
        </button>
      ))}
    </nav>
  );
}
