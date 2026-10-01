"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { LightbulbIcon, XIcon } from "@phosphor-icons/react";

type ReportCalloutProps = {
  title: string;
  children: ReactNode;
};

/** A dismissable hint box with a lightbulb, e.g. explaining what scheduling does. */
export function ReportCallout({ title, children }: ReportCalloutProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <aside className="flex flex-col gap-1 rounded-md border border-primary bg-primary/10 p-3 text-sm text-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-primary">
          <LightbulbIcon size={16} aria-hidden="true" />
          {title}
        </h3>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="cursor-pointer rounded-full p-1 text-primary hover:bg-primary/10"
        >
          <XIcon size={14} aria-hidden="true" />
        </button>
      </div>
      <p>{children}</p>
    </aside>
  );
}
