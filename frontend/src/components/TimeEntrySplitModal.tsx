"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useInvalidateTimeEntryViews } from "@/hooks/useInvalidateTimeEntryViews";
import { describeSplit, midpointOf } from "@/lib/describeSplit";
import { formatClockTime } from "@/lib/formatClockTime";
import { formatElapsed } from "@/lib/formatElapsed";
import { splitTimeEntry } from "@/lib/splitTimeEntry";
import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type TimeEntrySplitModalProps = {
  organisationId: string;
  entry: TimeEntryListItem;
  onClose: () => void;
};

/**
 * Cuts one entry into two at a chosen instant, previewing both halves as the
 * cut moves so the split is checked before it happens rather than undone
 * afterwards — there is no undo, only deleting a half and editing the other.
 */
export function TimeEntrySplitModal({
  organisationId,
  entry,
  onClose,
}: TimeEntrySplitModalProps) {
  const endedAt = entry.endedAt ?? entry.startedAt;
  // Opens at the midpoint, which is always a cut `describeSplit` accepts —
  // starting on a boundary would render the dialog invalid on arrival.
  const [at, setAt] = useState(() =>
    toDatetimeLocalValue(midpointOf(entry.startedAt, endedAt).toISOString()),
  );
  const invalidate = useInvalidateTimeEntryViews(organisationId);

  const halves = describeSplit(entry.startedAt, endedAt, at);

  const splitMutation = useMutation({
    mutationFn: () => splitTimeEntry(organisationId, entry.id, at),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onClose();
      }
    },
  });

  return (
    <Modal title="Split time entry" onClose={onClose}>
      <div className="flex w-full max-w-lg flex-col gap-5">
        <p className="text-sm text-slate-900">
          {entry.projectName} · {formatClockTime(entry.startedAt)} –{" "}
          {formatClockTime(endedAt)}
        </p>

        <label className="flex flex-col gap-1.5">
          Split at
          <input
            type="datetime-local"
            value={at}
            onChange={(event) => setAt(event.target.value)}
            className="w-full rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        {halves ? (
          <ul className="flex flex-col gap-2 text-sm text-slate-900">
            {[halves.first, halves.second].map((half) => (
              <li
                key={half.startedAt + half.endedAt}
                className="flex items-center justify-between rounded-md border border-input-border px-3 py-2"
              >
                <span>
                  {formatClockTime(half.startedAt)} – {formatClockTime(half.endedAt)}
                </span>
                <span className="tabular-nums">
                  {formatElapsed(half.seconds * 1000)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-error">
            Pick a time between the entry&apos;s start and end.
          </p>
        )}

        <button
          type="button"
          onClick={() => splitMutation.mutate()}
          disabled={!halves || splitMutation.isPending}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {splitMutation.isPending && <Spinner />}
          Split into two entries
        </button>
      </div>
    </Modal>
  );
}
