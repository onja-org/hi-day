"use client";

import { Toggle } from "@/components/Toggle";
import { describeWorkDays } from "@/lib/describeWorkDays";
import type { WorkTimeLimits } from "@/types/organisation";
import { HoursField } from "./HoursField";
import { WorkDayPills } from "./WorkDayPills";

type WorkTimeLimitsDefaultsProps = {
  draft: WorkTimeLimits;
  onChange: (next: WorkTimeLimits) => void;
};

/** The "Default settings" half: the organisation's own values. */
export function WorkTimeLimitsDefaults({
  draft,
  onChange,
}: WorkTimeLimitsDefaultsProps) {
  const toggleDay = (key: "expectedWorkDays" | "trackingDisabledDays") =>
    (day: number) =>
      onChange({
        ...draft,
        [key]: draft[key].includes(day)
          ? draft[key].filter((value) => value !== day)
          : [...draft[key], day],
      });

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
            Weekly work days
          </h3>
          <p className="text-sm text-slate-900">
            Set the week days members are expected to work. You can also set
            which days members are not allowed to track time.
          </p>
        </div>

        <p className="text-sm text-slate-900">
          Expected work days:{" "}
          <span className="font-semibold">
            {describeWorkDays(draft.expectedWorkDays)}
          </span>
        </p>
        <WorkDayPills
          label="Expected work days"
          selected={draft.expectedWorkDays}
          onToggle={toggleDay("expectedWorkDays")}
        />

        <Toggle
          name="disableTrackingOnSpecificDays"
          label="Disable time tracking on specific days"
          description="Members can't start a timer on the days you pick below."
          checked={draft.trackingDisabledDays.length > 0}
          // Switching off clears the days rather than remembering them: a
          // hidden list that still blocked tracking would be invisible.
          onCheckedChange={(on) =>
            onChange({ ...draft, trackingDisabledDays: on ? [0, 6] : [] })
          }
        />
        {draft.trackingDisabledDays.length > 0 && (
          <WorkDayPills
            label="Days tracking is not allowed"
            selected={draft.trackingDisabledDays}
            onToggle={toggleDay("trackingDisabledDays")}
          />
        )}
      </section>

      <section className="flex max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
            Expected weekly work hours
          </h3>
          <p className="text-sm text-slate-900">
            Set the hours members are expected to work weekly
          </p>
          <HoursField
            label="Expected weekly work hours"
            unit="hrs/wk"
            value={draft.expectedWeeklyHours}
            onChange={(expectedWeeklyHours) =>
              onChange({ ...draft, expectedWeeklyHours })
            }
          />
          {draft.expectedWeeklyHours !== null && (
            <button
              type="button"
              onClick={() => onChange({ ...draft, expectedWeeklyHours: null })}
              className="cursor-pointer self-end text-sm font-medium text-primary hover:underline"
            >
              Remove
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
            Weekly limit
          </h3>
          <p className="text-sm text-slate-900">
            Set the hours members are allowed to work weekly
          </p>
          <HoursField
            label="Weekly limit"
            unit="hrs/wk"
            placeholder="No weekly limit"
            value={draft.weeklyLimitHours}
            onChange={(weeklyLimitHours) =>
              onChange({ ...draft, weeklyLimitHours })
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
            Daily limit
          </h3>
          <p className="text-sm text-slate-900">
            Set the hours members are allowed to work daily
          </p>
          <HoursField
            label="Daily limit"
            unit="hrs/day"
            placeholder="No daily limit"
            max={24}
            value={draft.dailyLimitHours}
            onChange={(dailyLimitHours) =>
              onChange({ ...draft, dailyLimitHours })
            }
          />
        </div>
      </section>
    </div>
  );
}
