import clsx from "clsx";
import { PROJECT_COLOUR_BG_CLASSES } from "./ProjectColourBadge";
import type { ProjectColour } from "@/types/project";

type ProjectAvatarProps = {
  name: string;
  colour: ProjectColour;
};

/** The project's initial in its own colour, as the row's visual anchor.
 * Decorative — the project name is always spelled out beside it. */
export function ProjectAvatar({ name, colour }: ProjectAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        PROJECT_COLOUR_BG_CLASSES[colour],
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
