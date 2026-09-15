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
