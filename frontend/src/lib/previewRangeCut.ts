import type { CutMode, PauseSpan } from "@/types/timeEntry";

/** One entry a cut would leave, or the range it would drop (`removed`). */
export type RangeCutPiece = {
  startedAt: string;
  endedAt: string;
  /** Worked seconds, net of the pauses that fall inside this piece. */
  seconds: number;
  removed: boolean;
};

export type RangeCutPreview =
  | { ok: true; from: string; to: string; pieces: RangeCutPiece[] }
  | { ok: false; message: string };

const MINUTE_MS = 60_000;

/**
 * What cutting `[from, to)` out of a stopped entry would produce, checked
 * the way the server checks it, so the preview matches what gets saved.
 *
 * The time inputs only hold whole minutes, while an entry's own start and
 * end usually carry seconds. A typed time within a minute of either end is
 * read as that end exactly, so "09:00" cuts from an entry starting at
 * 09:00:42 rather than being refused for falling before it. `from` and `to`
 * in the result are the instants to send.
 *
 * Durations subtract the pauses inside each piece, as the server's
 * `durationSeconds` does after it moves each pause onto the piece it falls in.
 */
export function previewRangeCut(
  entry: { startedAt: string; endedAt: string; pauses: PauseSpan[] },
  from: string,
  to: string,
  mode: CutMode,
): RangeCutPreview {
  const start = new Date(entry.startedAt).getTime();
  const end = new Date(entry.endedAt).getTime();
  let fromMs = new Date(from).getTime();
  let toMs = new Date(to).getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return { ok: false, message: "Enter both times of the range." };
  }
  if (Math.abs(fromMs - start) < MINUTE_MS) fromMs = start;
  if (Math.abs(toMs - end) < MINUTE_MS) toMs = end;

  if (toMs <= fromMs) {
    return { ok: false, message: "The range must end after it starts." };
  }
  if (fromMs < start || toMs > end) {
    return {
      ok: false,
      message: "The range must fall between the start and end of the entry.",
    };
  }
  if (fromMs === start && toMs === end) {
    return {
      ok: false,
      message:
        mode === "remove"
          ? "The range covers the whole entry — delete the entry instead."
          : "The range covers the whole entry, so there is nothing to split.",
    };
  }

  const piece = (pieceStart: number, pieceEnd: number, removed: boolean) => ({
    startedAt: new Date(pieceStart).toISOString(),
    endedAt: new Date(pieceEnd).toISOString(),
    seconds: Math.round(
      (pieceEnd - pieceStart - pausedWithin(entry.pauses, pieceStart, pieceEnd)) /
        1000,
    ),
    removed,
  });
  const pieces: RangeCutPiece[] = [];
  if (fromMs > start) pieces.push(piece(start, fromMs, false));
  pieces.push(piece(fromMs, toMs, mode === "remove"));
  if (toMs < end) pieces.push(piece(toMs, end, false));

  return {
    ok: true,
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    pieces,
  };
}

/** Milliseconds of closed pause inside `[start, end)`. */
function pausedWithin(pauses: PauseSpan[], start: number, end: number): number {
  return pauses.reduce((total, pause) => {
    if (pause.resumedAt === null) return total;
    const overlap =
      Math.min(new Date(pause.resumedAt).getTime(), end) -
      Math.max(new Date(pause.pausedAt).getTime(), start);
    return total + Math.max(0, overlap);
  }, 0);
}
