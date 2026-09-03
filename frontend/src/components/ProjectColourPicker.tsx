"use client";

import clsx from "clsx";
import type { ProjectColour } from "@/types/project";

type ProjectColourPickerProps = {
  value: ProjectColour;
  onChange: (colour: ProjectColour) => void;
};

const COLOURS: { value: ProjectColour; label: string; className: string }[] = [
  { value: "blue", label: "Blue", className: "bg-project-blue" },
  { value: "green", label: "Green", className: "bg-project-green" },
  { value: "amber", label: "Amber", className: "bg-project-amber" },
  { value: "red", label: "Red", className: "bg-project-red" },
  { value: "purple", label: "Purple", className: "bg-project-purple" },
  { value: "teal", label: "Teal", className: "bg-project-teal" },
  { value: "pink", label: "Pink", className: "bg-project-pink" },
  { value: "gray", label: "Gray", className: "bg-project-gray" },
];

export function ProjectColourPicker({ value, onChange }: ProjectColourPickerProps) {
  return (
    <div role="radiogroup" aria-label="Project colour" className="flex flex-wrap gap-2">
      {COLOURS.map((colour) => (
        <button
          key={colour.value}
          type="button"
          role="radio"
          aria-checked={value === colour.value}
          aria-label={colour.label}
          title={colour.label}
          onClick={() => onChange(colour.value)}
          className={clsx(
            "h-8 w-8 cursor-pointer rounded-full ring-offset-2 transition-shadow duration-150",
            colour.className,
            value === colour.value ? "ring-2 ring-primary-dark" : "ring-0",
          )}
        />
      ))}
    </div>
  );
}
