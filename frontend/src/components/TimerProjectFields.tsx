"use client";

import { useProjectTasks } from "@/hooks/useProjectTasks";
import { formatElapsed } from "@/lib/formatElapsed";
import type { ProjectListItem } from "@/types/project";
import { SelectField } from "@/components/ui/form/SelectField";

type TimerProjectFieldsProps = {
  organisationId: string;
  projects: ProjectListItem[];
  projectId: string;
  taskId: string;
  projectSecondsToday: Map<string, number>;
  /** The only startable Project; the rest are shown disabled, so a narrowed
   * list never reads as projects having gone missing. */
  requiredProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  onTaskChange: (taskId: string) => void;
};

/** The Project and Task selects of the timer picker. */
export function TimerProjectFields({
  organisationId,
  projects,
  projectId,
  taskId,
  projectSecondsToday,
  requiredProjectId,
  onProjectChange,
  onTaskChange,
}: TimerProjectFieldsProps) {
  const tasksQuery = useProjectTasks(organisationId, projectId, {
    enabled: projectId !== "",
  });
  const tasks =
    tasksQuery.data?.tasks.filter((task) => task.status === "open") ?? [];
  const selectedProjectSecondsToday = projectId
    ? (projectSecondsToday.get(projectId) ?? 0)
    : 0;

  return (
    <>
      <div className="flex flex-1 flex-col gap-1">
        <SelectField
          label="Project"
          compact
          value={projectId}
          onChange={(event) => onProjectChange(event.target.value)}
        >
          <option value="">Select a project…</option>
          {projects.map((project) => (
            <option
              key={project.id}
              value={project.id}
              disabled={
                requiredProjectId !== null && project.id !== requiredProjectId
              }
            >
              {project.name}
            </option>
          ))}
        </SelectField>
        {projectId && selectedProjectSecondsToday > 0 && (
          <span className="text-xs text-slate-900/70">
            {formatElapsed(selectedProjectSecondsToday * 1000)} tracked today
          </span>
        )}
      </div>

      <SelectField
        label="Task (optional)"
        compact
        className="flex-1"
        value={taskId}
        onChange={(event) => onTaskChange(event.target.value)}
        disabled={!projectId}
      >
        <option value="">No task</option>
        {tasks.map((task) => (
          <option key={task.id} value={task.id}>
            {task.name}
          </option>
        ))}
      </SelectField>
    </>
  );
}
