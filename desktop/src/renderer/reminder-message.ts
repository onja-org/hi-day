/**
 * What the not-tracking reminder says.
 *
 * Three lines, following the shape Hubstaff uses: the fact, how long it
 * has been, and what is left of the day. The middle line is skipped
 * when nothing has been tracked at all — "you have not tracked in 25
 * minutes" would be a strange thing to tell someone who has not started
 * once, and the honest statement is simply that they have not.
 */
export interface ReminderFacts {
  untrackedMinutes: number;
  signedOut: boolean;
  workingHoursPerDay: number;
  /** Everything tracked today, across every project. */
  trackedTodaySeconds: number;
}

function describeDuration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole} minute${whole === 1 ? "" : "s"}`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  const hoursPart = `${hours} hour${hours === 1 ? "" : "s"}`;
  if (rest === 0) return hoursPart;
  return `${hoursPart}, ${rest} minute${rest === 1 ? "" : "s"}`;
}

export function reminderMessage(facts: ReminderFacts): string {
  const lines: string[] = [];

  if (facts.trackedTodaySeconds > 0) {
    lines.push(
      `You have not tracked time in ${describeDuration(facts.untrackedMinutes)}.`,
    );
  } else {
    lines.push("You have not tracked any time today.");
  }

  const remainingMinutes =
    facts.workingHoursPerDay * 60 - facts.trackedTodaySeconds / 60;
  if (remainingMinutes > 0) {
    lines.push(
      `There are ${describeDuration(remainingMinutes)} remaining in your work day.`,
    );
  }

  if (facts.signedOut) lines.push("Open Hi Day and log in to start tracking.");

  return lines.join("\n\n");
}
