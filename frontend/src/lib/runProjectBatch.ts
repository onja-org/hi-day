import type { ProjectBatchOutcome } from "@/types/project";

type BatchTarget = { id: string; name: string };

export type ProjectBatchResult = {
  /** True only when every project succeeded. */
  ok: boolean;
  /** e.g. "Archived 4 of 5 projects", for the mutation toast. */
  message: string;
  outcomes: ProjectBatchOutcome[];
};

/**
 * Runs one action per project, one request at a time, and reports each
 * outcome — so a project the backend refuses (a running timer, logged time)
 * doesn't stop the rest of the batch.
 */
export async function runProjectBatch<T extends BatchTarget>(
  projects: T[],
  action: (project: T) => Promise<{ ok: boolean; message: string }>,
  pastTenseVerb: string,
): Promise<ProjectBatchResult> {
  const outcomes: ProjectBatchOutcome[] = [];
  for (const project of projects) {
    const result = await action(project);
    outcomes.push({
      projectId: project.id,
      name: project.name,
      ok: result.ok,
      message: result.message,
    });
  }
  const succeeded = outcomes.filter((outcome) => outcome.ok).length;
  return {
    ok: succeeded === outcomes.length,
    message: `${pastTenseVerb} ${succeeded} of ${outcomes.length} ${outcomes.length === 1 ? "project" : "projects"}`,
    outcomes,
  };
}
