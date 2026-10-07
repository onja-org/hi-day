export type TimeEntryFieldErrors = {
  /** Shown under Start. */
  startedAt?: string;
  /** Shown under End. */
  endedAt?: string;
  /** Concerns the pair, so it sits under both rather than on one. */
  range?: string;
  /** Nothing to do with the times — shown above the submit button. */
  form?: string;
};

/**
 * Which field a time-entry problem belongs under.
 *
 * The server owns these rules and already phrases them for a person, so its
 * message is shown verbatim rather than re-written here — this only decides
 * *where* it goes. Matching is on the distinguishing word rather than the
 * whole sentence, so a reworded message still lands in the right place
 * instead of silently falling through to the form.
 */
export function serverMessageToField(message: string): TimeEntryFieldErrors {
  const text = message.toLowerCase();
  // Concerns both times at once: neither is wrong on its own.
  if (text.includes("overlap")) return { range: message };
  if (text.includes("after the start") || text.includes("future")) {
    return { endedAt: message };
  }
  return { form: message };
}

/**
 * What the browser can decide without asking the server: that an end exists,
 * follows its start, and is not in the future.
 *
 * Deliberately the same rules the server enforces, so the form never accepts
 * something it will then be told off for. Overlap is absent on purpose — the
 * form only knows the entries currently loaded, which is rarely all of them.
 */
export function validateTimeRange(
  startedAt: string,
  endedAt: string,
  now: Date = new Date(),
): TimeEntryFieldErrors {
  if (!startedAt) return { startedAt: "Enter a start time." };
  if (!endedAt) return { endedAt: "Enter an end time." };

  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (Number.isNaN(start)) return { startedAt: "Enter a valid start time." };
  if (Number.isNaN(end)) return { endedAt: "Enter a valid end time." };

  if (end <= start) return { endedAt: "End time must be after the start time." };
  if (end > now.getTime()) return { endedAt: "End time cannot be in the future." };
  return {};
}

/** True when nothing is wrong. */
export function hasNoErrors(errors: TimeEntryFieldErrors): boolean {
  return Object.values(errors).every((value) => value === undefined);
}
