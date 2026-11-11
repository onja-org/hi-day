---
status: accepted
---

# Running entries can be edited

ADR-0007 had `update` refuse a still-running entry and send the caller to `stop`/`switch`. The backend has since let an unstopped entry have its Project, Task and start corrected, refusing only an end time, but the web still greyed out Edit on a ticking entry ("Stop the timer first"). An admin moving their team from Hubstaff hit this when adding a member's earlier hours for today: in Hubstaff a running entry can be edited, so Hi Day forcing a stop read as a missing feature.

Edit now opens on a running entry for anyone who can edit other entries (the Modify time setting, `canEdit`).

## Decisions

- **Start, Project and Task can change; the timer keeps running.** The form withholds the End field on a ticking entry, and `update` still refuses `endedAt` on one. Stop stays the only way a running entry ends, so every end is still recorded as `time_entry.stopped`. The edit itself is audited as `time_entry.updated`, like any other.
- **A Project change takes the time already accrued with it.** ADR-0007 rejected this for lacking a clean "when did the attribution change" boundary. The answer is that it changes the whole entry, the same as editing a finished one. Someone who means "from now on" uses Switch; someone who means "this was the other project all along" uses Edit.
- **A new start is checked against "now".** A running entry has no end, so the span it claims runs to the present. A new start must not be in the future and must not overlap another entry up to now, under the same tracked/manual overlap rules as any edit (`assertNoOverlap`). Otherwise moving a start earlier over time already tracked would count it twice.
- **A new start can't pass the timer's first pause.** Pauses are subtracted from an entry's duration, so a pause left before the start would take away time the entry no longer covers.
- **The desktop re-syncs when its running entry's start changes.** It used to re-sync its clock only when the running entry's id changed, so a start corrected on the web kept the old elapsed time on the desktop until a relaunch.

## Not handled

- **Merging a running entry.** An overlapping start on a running entry is still refused. Merging is offered for stopped entries only (ADR-0036), since a running one has no end to merge up to.
