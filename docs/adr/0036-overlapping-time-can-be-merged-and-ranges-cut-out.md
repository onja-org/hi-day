---
status: accepted
---

# Overlapping time can be merged, and a typed range can be cut out of an entry

An admin moving their team from Hubstaff found two things harder than they expected. Splitting meant picking one instant and getting two entries, where Hubstaff lets you type the range to cut out. Adding a member's earlier hours over time already tracked was refused, with no way forward except retyping the times.

## Decisions

### Cutting a range (`POST .../time-entries/:id/cut`)

- **A range, not a point.** The person types `[from, to)` inside a stopped entry and chooses **remove** (drop it, keep the time either side as two entries) or **split** (keep all three pieces, so the middle can move to another Project).
- **Built from the existing split, twice.** The entry is cut at `to`, then at `from`, each cut moving the pauses after it onto the new piece. The original row stays the earliest piece and keeps its id. Remove then deletes the middle piece and prunes the captures nothing else covers, as deleting an entry does.
- **Removing needs a reason when the organisation requires one;** splitting doesn't, as before. Removed time is recorded as `time_entry.range_removed`, shaped like a deletion's snapshot, so the Manual time edits report shows it as a deletion of that span.
- **The preview is computed like the save.** The web works out each piece and its duration net of the pauses inside it, as the server does after moving them. A typed time within a minute of the entry's start or end means that end exactly, because the time inputs hold whole minutes and entries carry seconds.

### Merging overlaps (`merge: true` on add and edit)

- **Offered only where a save is refused.** Hand-added time over any of the person's entries, or an edit over another entry from the same Device. Laptop and desktop tracking at once is never refused (ADR-0022), so it's never merged. The refusal now lists the entries in the way and says whether merging is possible.
- **The form's choice wins.** The merged entry runs from the earliest start to the latest end, on the Project and Task chosen in the form.
- **A tracked row survives.** If any piece was tracked, the earliest tracked one is kept (id, Device, `source`), so its screenshots and activity stay attached. The entry is `manual` only when every piece was. The span only grows, so no capture falls outside it.
- **Pauses become the gaps nobody worked.** The pieces' own pauses are replaced by the stretches inside the merged span where no piece was active. Time the pieces shared counts once, and a break never becomes worked time, so the person's daily total is the union it was before plus whatever new time was added. `time_entry.merged` records that difference as `addedSeconds`, which the report shows as the change.
- **The grown span pulls in what it reaches.** After widening, anything else on the same timeline it now overlaps is folded in too, so the result never overlaps a neighbour.
- **A running entry can't be merged.** It has no end to merge up to. The refusal says so; the fix is to edit its start (ADR-0035).

## Not handled

- **Merging a running entry.** See above.
- **The single-instant split endpoint** (`POST .../split`) is kept for compatibility but the web no longer uses it.
