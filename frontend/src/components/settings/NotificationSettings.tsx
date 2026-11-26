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
    <div className="grid gap-6 py-6 md:grid-cols-[14rem_1fr] md:gap-8">
      <SettingsSubNav
        label="Notifications sub-sections"
        items={SUB_NAV}
        active={active}
        onSelect={setActive}
      />

      <div className="min-w-0">
        {/* Keyed, so switching panels starts the other from a clean state. */}
        <SummaryEmailPanel key={active} audience={active} />
      </div>
    </div>
  );
}
