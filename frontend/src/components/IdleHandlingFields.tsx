import { useState } from "react";
import clsx from "clsx";
import type { IdleHandling, OrganisationProfile } from "@/types/organisation";

type IdleHandlingFieldsProps = {
  organisation: OrganisationProfile;
};

const IDLE_OPTIONS: {
  value: IdleHandling;
  title: string;
  description: string;
}[] = [
  {
    value: "flag",
    title: "Ask the person",
    description: "Flag the period and let them keep or discard it.",
  },
  {
    value: "off",
    title: "Keep it",
    description: "Count idle time as worked time.",
  },
  {
    value: "auto_subtract",
    title: "Discard it",
    description: "Remove idle time from the timesheet automatically.",
  },
];

/** "Keep idle time": what happens to a stretch once it counts as idle.
 * How long that takes is `IdleTimeoutField`. */
export function IdleHandlingFields({ organisation }: IdleHandlingFieldsProps) {
  const [handling, setHandling] = useState(organisation.idleHandling);

  return (
    <div className="@container flex flex-col gap-3 rounded-lg border border-input-border bg-white p-5">
      <span className="text-sm font-medium text-slate-900">
        When idle time is detected
      </span>
      <div className="grid gap-3 @md:grid-cols-3">
        {IDLE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={clsx(
              "flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors duration-150",
              handling === option.value
                ? "border-primary ring-2 ring-primary/20"
                : "border-input-border hover:border-primary/50",
            )}
          >
            <span className="flex items-center gap-2 font-medium text-slate-900">
              <input
                type="radio"
                name="idleHandling"
                value={option.value}
                checked={handling === option.value}
                onChange={() => setHandling(option.value)}
                className="h-4 w-4 accent-primary"
              />
              {option.title}
            </span>
            <span className="text-sm text-slate-900/60">
              {option.description}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
