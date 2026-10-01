import { formatShortDate } from "@/lib/formatShortDate";
import type { OrganisationDeletionMode } from "@/types/organisation";
import { DeletionModeOption } from "./DeletionModeOption";

type DeletionWhenFieldsProps = {
  mode: OrganisationDeletionMode;
  onModeChange: (mode: OrganisationDeletionMode) => void;
  scheduledDate: string;
  onScheduledDateChange: (date: string) => void;
  /** Earliest selectable date, as a yyyy-mm-dd input value. */
  minDate: string;
  /** Null while the status is still loading. */
  graceDays: number | null;
};

/** The "When" choice: delete now, or pick a later date. */
export function DeletionWhenFields({
  mode,
  onModeChange,
  scheduledDate,
  onScheduledDateChange,
  minDate,
  graceDays,
}: DeletionWhenFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-primary-dark">
        When
      </legend>
      <DeletionModeOption
        title="Delete now"
        description={`Suspended immediately. Permanently deleted after ${graceDays ?? "…"} days — an owner can restore it until then.`}
        checked={mode === "now"}
        onSelect={() => onModeChange("now")}
      />
      <DeletionModeOption
        title="Schedule for a later date"
        description="Keeps working normally until the date you pick."
        checked={mode === "scheduled"}
        onSelect={() => onModeChange("scheduled")}
      >
        <div className="flex flex-col gap-1.5 pl-7">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-900">
              Deletion date
            </span>
            <input
              type="date"
              value={scheduledDate}
              min={minDate}
              onChange={(event) => onScheduledDateChange(event.target.value)}
              required
              className="w-fit rounded-md border border-input-border bg-white px-3 h-11 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          {scheduledDate && (
            <p className="text-xs text-slate-900/60">
              Suspended on{" "}
              {formatShortDate(new Date(`${scheduledDate}T00:00:00`))},
              permanently deleted {graceDays ?? "…"} days later.
            </p>
          )}
        </div>
      </DeletionModeOption>
    </fieldset>
  );
}
