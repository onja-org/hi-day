import { formatTimeOfDay } from "./formatTimeOfDay";

type DeletableScreenshot = {
  capturedAt: string;
  /** null = no covering TimeEntry, shown as "No project" in the gallery. */
  projectId: string | null;
};

const UNTRACKED = "untracked time";

function permanence(count: number): string {
  return `The ${count === 1 ? "image is" : "images are"} removed permanently and cannot be undone. The tracked time stays on the timesheet.`;
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Spells out what a delete would take, so a selection built up over a
 * long scroll can be checked before it goes. */
export function describeScreenshotDeletion(
  screenshots: DeletableScreenshot[],
  projectName: (projectId: string) => string | undefined,
): string {
  if (screenshots.length === 0) return permanence(0);

  const times = screenshots
    .map((screenshot) => new Date(screenshot.capturedAt).getTime())
    .sort((a, b) => a - b);
  const from = formatTimeOfDay(new Date(times[0]));
  const to = formatTimeOfDay(new Date(times[times.length - 1]));
  const when = from === to ? `at ${from}` : `between ${from} and ${to}`;

  const names = [
    ...new Set(
      screenshots.map(
        (screenshot) =>
          (screenshot.projectId && projectName(screenshot.projectId)) ||
          UNTRACKED,
      ),
    ),
  ];
  const noun = screenshots.length === 1 ? "screenshot" : "screenshots";
  const where =
    names.length > 1
      ? `across ${joinNames(names)}`
      : names[0] === UNTRACKED
        ? "with no project"
        : `on ${names[0]}`;

  return `${screenshots.length} ${noun} captured ${when}, ${where}.\n\n${permanence(screenshots.length)}`;
}
