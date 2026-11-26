"use client";

import { useState } from "react";
import { SettingsSubNav } from "./SettingsSubNav";
import type { SettingsSubNavItem } from "./SettingsSubNav";
import { SummaryEmailPanel } from "./SummaryEmailPanel";

type SubNavKey = "personal" | "team";

const SUB_NAV: SettingsSubNavItem<SubNavKey>[] = [
  { key: "personal", label: "Personal summary" },
  { key: "team", label: "Team summary" },
];

export function NotificationSettings() {
  const [active, setActive] = useState<SubNavKey>("personal");

  return (
    <div className="flex flex-col gap-6 py-6 md:flex-row md:gap-8">
      <div className="md:w-56 md:shrink-0">
        <SettingsSubNav
          label="Notifications sub-sections"
          items={SUB_NAV}
          active={active}
          onSelect={setActive}
        />
      </div>

      <div className="min-w-0 md:flex-1">
        {/* Keyed, so switching panels starts the other from a clean state. */}
        <SummaryEmailPanel key={active} audience={active} />
      </div>
    </div>
  );
}
