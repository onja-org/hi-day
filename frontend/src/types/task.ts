import type { ApiResult } from "./api";
import type { ProjectColour, ProjectStatus } from "./project";

export type TaskStatus = "open" | "closed";

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
  assignee: TaskAssignee | null;
  assignedToMe: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskProjectContext = {
  id: string;
  name: string;
  client: string | null;
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
  description?: string;
  estimate?: string;
  dueDate?: string;
  assigneeProjectMembershipId?: string | null;
};

export type GetProjectTasksResult =
  | { ok: true; data: ProjectTasksList }
  | { ok: false; message: string };

export type CreateTaskResult = ApiResult<{ task: Task }>;

export type UpdateTaskResult = ApiResult<{ task: Task }>;

export type CloseTaskResult = ApiResult<{ task: Task }>;

export type ReopenTaskResult = ApiResult<{ task: Task }>;
