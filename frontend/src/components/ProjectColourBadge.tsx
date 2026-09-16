import clsx from "clsx";
import type { ProjectColour } from "@/types/project";

type ProjectColourBadgeProps = {
  colour: ProjectColour;
  className?: string;
};

// Exported so any other per-project visual (e.g. a chart bar) can reuse the
// exact same literal class list — Tailwind needs these as literal strings in
// source to generate their CSS, so `bg-project-${colour}` string
// interpolation elsewhere would silently produce no styles.
export const PROJECT_COLOUR_BG_CLASSES: Record<ProjectColour, string> = {
  blue: "bg-project-blue",
  green: "bg-project-green",
  amber: "bg-project-amber",
  red: "bg-project-red",
  purple: "bg-project-purple",
  teal: "bg-project-teal",
  pink: "bg-project-pink",
  gray: "bg-project-gray",
};

// Same reasoning as the bg map above, for SVG shapes that fill with
// `currentColor` (e.g. the timesheet's timeline bar and calendar grid).
export const PROJECT_COLOUR_TEXT_CLASSES: Record<ProjectColour, string> = {
  blue: "text-project-blue",
  green: "text-project-green",
  amber: "text-project-amber",
  red: "text-project-red",
  purple: "text-project-purple",
  teal: "text-project-teal",
  pink: "text-project-pink",
  gray: "text-project-gray",
};

// A paused span within an entry reuses its project's own colour at reduced
// opacity — "still this task, but paused" — rather than a new color.
export const PROJECT_COLOUR_TEXT_MUTED_CLASSES: Record<ProjectColour, string> = {
  blue: "text-project-blue/30",
  green: "text-project-green/30",
  amber: "text-project-amber/30",
  red: "text-project-red/30",
  purple: "text-project-purple/30",
  teal: "text-project-teal/30",
  pink: "text-project-pink/30",
  gray: "text-project-gray/30",
};

export function ProjectColourBadge({ colour, className }: ProjectColourBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "inline-block h-3 w-3 shrink-0 rounded-full",
        PROJECT_COLOUR_BG_CLASSES[colour],
        className,
      )}
    />
  );
}
