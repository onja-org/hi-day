/**
 * The seat rules the browser needs, on top of the generated copy of the
 * backend's own (`seatRules.generated.ts`). Anything shared lives there so
 * it cannot drift; only what the server has no use for is written here.
 */
export {
  MAX_PURCHASABLE_SEATS,
  MIN_PURCHASABLE_SEATS,
  parseSeatCount,
} from "./seatRules.generated";

import { parseSeatCount } from "./seatRules.generated";

/** What a typed seat field means, treating an empty box as "still typing". */
export function parseSeatInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) return null;
  return parseSeatCount(Number(trimmed));
}

export type SeatOccupancy = {
  /** Seats bought, or the team itself where none were bought. */
  total: number;
  /** Members sitting in bought seats, never more than there are seats. */
  filled: number;
  /** Members beyond the purchase. Zero while the team fits. */
  overBy: number;
  /** How much of the purchase is occupied, 0 to 1. */
  fraction: number;
};

/**
 * How full the purchase is, for the seats panel.
 *
 * `filled` is capped at `total` on purpose, with the excess in `overBy`:
 * drawing an over-subscribed organisation as a full bar says "perfectly
 * full" about the one state that most needs pointing out.
 */
export function seatOccupancy(
  memberCount: number,
  purchasedSeats: number | null,
): SeatOccupancy {
  const total = Math.max(purchasedSeats ?? memberCount, 1);
  const filled = Math.min(memberCount, total);
  return {
    total,
    filled,
    overBy: Math.max(memberCount - total, 0),
    fraction: filled / total,
  };
}
