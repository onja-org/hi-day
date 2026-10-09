"use client";

import { useState } from "react";
import clsx from "clsx";
import { TimesheetModifyTimePanel } from "./TimesheetModifyTimePanel";
import { TimesheetReasonsPanel } from "./TimesheetReasonsPanel";
import { TimesheetRequireReasonPanel } from "./TimesheetRequireReasonPanel";

type SubNavKey = "modify-time" | "require-reason" | "reasons";

const SUB_NAV: { key: SubNavKey; label: string }[] = [
  { key: "modify-time", label: "Modify time (manual time)" },
  { key: "require-reason", label: "Require reason" },
  { key: "reasons", label: "Reasons" },
];

export function TimesheetSettings() {
  const [active, setActive] = useState<SubNavKey>("modify-time");

  return (
    <div className="grid gap-6 py-6 md:grid-cols-[14rem_1fr] md:gap-8">
      <nav aria-label="Timesheets sub-sections">
        <ul className="flex flex-col gap-0.5">
          {SUB_NAV.map((item) => {
            const isActive = item.key === active;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setActive(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "block w-full rounded-brand-sm px-3 py-2 text-left text-sm font-semibold transition-colors duration-150",
                    isActive && "bg-cream text-primary",
                    !isActive && "text-slate-900 hover:bg-cream/50",
                  )}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        {active === "modify-time" && <TimesheetModifyTimePanel />}
        {active === "require-reason" && <TimesheetRequireReasonPanel />}
        {active === "reasons" && <TimesheetReasonsPanel />}
      </div>
    </div>
  );
}
