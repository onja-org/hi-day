import clsx from "clsx";
import type { ProjectStatus } from "@/types/project";

type ProjectsTabsProps = {
  active: ProjectStatus;
  counts: Record<ProjectStatus, number>;
  onChange: (status: ProjectStatus) => void;
};

const TABS: { status: ProjectStatus; label: string }[] = [
  { status: "active", label: "Active" },
  { status: "archived", label: "Archived" },
];

export function ProjectsTabs({ active, counts, onChange }: ProjectsTabsProps) {
  return (
    <div className="flex gap-1 border-b border-input-border">
      {TABS.map((tab) => {
        const isActive = tab.status === active;
        return (
          <button
            key={tab.status}
            type="button"
            onClick={() => onChange(tab.status)}
            aria-pressed={isActive}
            className={clsx(
              "-mb-px cursor-pointer border-b-2 px-4 py-2 text-sm font-medium tracking-wide uppercase transition-colors duration-150",
              isActive && "border-primary text-primary",
              !isActive && "border-transparent text-slate-900 hover:text-primary-dark",
            )}
          >
            {tab.label} ({counts[tab.status]})
          </button>
        );
      })}
    </div>
  );
}
