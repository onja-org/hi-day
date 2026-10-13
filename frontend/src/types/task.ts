import type { ApiResult } from "./api";
import type { ProjectColour, ProjectStatus } from "./project";

export type TaskStatus = "open" | "closed";

/** Kanban column. "done" is kept in step with `status: "closed"` server-side. */
export type TaskStage = "todo" | "in_progress" | "done";

export type TaskAssignee = {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
};

export type Task = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  estimate: string | null;
  dueDate: string | null;
  status: TaskStatus;
  closedAt: string | null;
  stage: TaskStage;
  assignee: TaskAssignee | null;
  assignedToMe: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskProjectContext = {
  id: string;
  name: string;
  colour: ProjectColour;
  status: ProjectStatus;
};

export type ProjectTasksList = {
  project: TaskProjectContext;
  tasks: Task[];
  canManage: boolean;
};

export type TaskFormInput = {
  name: string;
  description?: string;
  estimate?: string;
  dueDate?: string;
  assigneeProjectMembershipId?: string;
};

export type UpdateTaskInput = {
  name?: string;
  // null clears the value; omitted leaves it unchanged.
  description?: string | null;
  estimate?: string | null;
  dueDate?: string | null;
  assigneeProjectMembershipId?: string | null;
};

export type GetProjectTasksResult =
  | { ok: true; data: ProjectTasksList }
  | { ok: false; message: string };

export type CreateTaskResult = ApiResult<{ task: Task }>;

export type UpdateTaskResult = ApiResult<{ task: Task }>;

export type CloseTaskResult = ApiResult<{ task: Task }>;

export type ReopenTaskResult = ApiResult<{ task: Task }>;

export type SetTaskStageResult = ApiResult<{ task: Task }>;
