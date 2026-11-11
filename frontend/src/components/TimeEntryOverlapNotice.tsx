import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { formatClockTime } from "@/lib/formatClockTime";
import type { OverlapConflict } from "@/types/timeEntry";
import { Spinner } from "./Spinner";

type TimeEntryOverlapNoticeProps = {
  conflict: OverlapConflict;
  isPending: boolean;
  onMerge: () => void;
};

/**
 * Which entries a save ran into, with the offer to merge them into one
 * instead. The merged entry runs from the earliest start to the latest end
 * — on the project chosen in this form, when the organisation tracks
 * Projects — and time shared by the entries counts once.
 */
export function TimeEntryOverlapNotice({ conflict, isPending, onMerge }: TimeEntryOverlapNoticeProps) {
  const projectsEnabled = useProjectsEnabled();

  return (
    <section
      aria-label="Overlapping entries"
      className="flex flex-col gap-3 rounded-brand-sm border-2 border-ink bg-cream p-4 text-sm text-slate-900"
    >
      <p className="font-semibold">
        {conflict.overlaps.length === 1
          ? "This overlaps 1 entry:"
          : `This overlaps ${conflict.overlaps.length} entries:`}
      </p>
      <ul className="flex flex-col gap-1">
        {conflict.overlaps.map((overlap) => (
          <li key={overlap.id}>
            {overlap.projectName ?? "No project"} ·{" "}
            {formatClockTime(overlap.startedAt)}–
            {overlap.endedAt ? formatClockTime(overlap.endedAt) : "now"}
          </li>
        ))}
      </ul>
      {conflict.canMerge ? (
        <>
          <p className="text-slate-900/70">
            Merge them into one entry, from the earliest start to the latest
            end{projectsEnabled && ", on the project chosen here"}. Time they
            share is counted once.
          </p>
          <button
            type="button"
            onClick={onMerge}
            disabled={isPending}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm border-2 border-primary px-4 h-11 font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && <Spinner />}
            Merge into one entry
          </button>
        </>
      ) : (
        <p className="text-slate-900/70">
          One of them is still running, so they can&apos;t be merged. Stop it
          first, or change the times.
        </p>
      )}
    </section>
  );
}
