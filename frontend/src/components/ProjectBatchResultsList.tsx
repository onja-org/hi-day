import clsx from "clsx";
import type { ProjectBatchOutcome } from "@/types/project";

type ProjectBatchResultsListProps = {
  outcomes: ProjectBatchOutcome[];
};

export function ProjectBatchResultsList({ outcomes }: ProjectBatchResultsListProps) {
  const succeeded = outcomes.filter((outcome) => outcome.ok).length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-primary-dark">
        {succeeded} of {outcomes.length} {outcomes.length === 1 ? "project" : "projects"} done
      </p>
      <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-md border border-input-border p-3 text-sm text-slate-900">
        {outcomes.map((outcome) => (
          <li key={outcome.projectId} className="flex flex-col gap-0.5">
            <span>{outcome.name}</span>
            <span className={clsx(outcome.ok && "text-success", !outcome.ok && "text-error")}>
              {outcome.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
