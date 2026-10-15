"use client";

import { SettingsPanel } from "@/components/SettingsPanel";
import { SettingsSectionRow } from "@/components/SettingsSectionRow";
import { MIN_REMINDER_INTERVAL_MINUTES } from "@/lib/trackingReminderInterval";

/** Reads the form back as the two fields this section owns. `0` is the
 * off switch, the same convention screenshot frequency uses. */
function buildInput(formData: FormData) {
  const on = formData.get("remindersEnabled") !== null;
  const minutes = Number(formData.get("reminderIntervalMinutes"));
  return {
    reminderIntervalMinutes: on && Number.isFinite(minutes) ? minutes : 0,
    reminderDelivery:
      formData.get("reminderDelivery") === "alert"
        ? ("alert" as const)
        : ("notification" as const),
  };
}

export function TrackingRemindersPanel() {
  return (
    <SettingsPanel buildInput={buildInput}>
      {(organisation) => {
        const { intervalMinutes, delivery } = organisation.trackingReminders;
        return (
          <SettingsSectionRow
            title="Remind me to track time"
            description="Nudges a member whose app is open with no timer running — the morning they forget to start it. Stays quiet when nobody is at the machine."
          >
            <div className="flex flex-col gap-5">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="remindersEnabled"
                  defaultChecked={intervalMinutes > 0}
                  className="accent-primary"
                />
                <span className="text-slate-900">Send reminders</span>
              </label>

              <label className="flex max-w-xs flex-col gap-1">
                <span className="text-sm font-medium text-slate-900">
                  Remind every
                </span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    name="reminderIntervalMinutes"
                    min={MIN_REMINDER_INTERVAL_MINUTES}
                    max={240}
                    step={5}
                    defaultValue={
                      intervalMinutes > 0 ? intervalMinutes : 10
                    }
                    className="h-11 w-24 rounded-brand-sm border-2 border-ink bg-white px-3 focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-sm text-slate-900/70">
                    minutes, while untracked
                  </span>
                </span>
              </label>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium text-slate-900">
                  How to interrupt
                </legend>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="reminderDelivery"
                    value="notification"
                    defaultChecked={delivery === "notification"}
                    className="accent-primary"
                  />
                  <span className="text-slate-900">
                    Notification — a tray popup; opens the app when clicked
                  </span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="reminderDelivery"
                    value="alert"
                    defaultChecked={delivery !== "notification"}
                    className="accent-primary"
                  />
                  <span className="text-slate-900">
                    Alert — opens the app in front of them (default)
                  </span>
                </label>
              </fieldset>
            </div>
          </SettingsSectionRow>
        );
      }}
    </SettingsPanel>
  );
}
