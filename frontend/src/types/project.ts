import type { ApiResult } from "./api";

export type ProjectColour =
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple"
  | "teal"
  | "pink"
  | "gray";

export type ProjectStatus = "active" | "archived";

export type ProjectMembershipRole = "manager" | "member";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  colour: ProjectColour;
  status: ProjectStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMember = {
  id: string;
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  role: ProjectMembershipRole;
};

export type ProjectTeamMember = {
  id: string;
  teamId: string;
  name: string;
};

export type ProjectDetail = Project & {
  members: ProjectMember[];
  teams: ProjectTeamMember[];
};

export type ProjectListItem = Project & {
  taskCount: number;
};

export type CreateProjectMemberInput = {
  membershipId: string;
  role?: ProjectMembershipRole;
};

export type ProjectFormInput = {
  name: string;
  description?: string;
  colour?: ProjectColour;
  members?: CreateProjectMemberInput[];
  teamIds?: string[];
};

export type GetProjectsResult =
  | { ok: true; projects: ProjectListItem[] }
  | { ok: false; message: string };

export type GetProjectResult =
  | { ok: true; project: ProjectDetail }
  | { ok: false; message: string };

export type CreateProjectResult = ApiResult<{ project: Project }>;

export type UpdateProjectResult = ApiResult<{ project: Project }>;

export type ArchiveProjectResult = ApiResult<{ project: Project }>;

export type AddProjectMemberInput = {
  membershipId: string;
  role?: ProjectMembershipRole;
};

export type AddProjectMemberResult = ApiResult<{ member: ProjectMember }>;

export type UpdateProjectMemberInput = {
  role?: ProjectMembershipRole;
};

export type UpdateProjectMemberResult = ApiResult<{ member: ProjectMember }>;

export type RemoveProjectMemberResult = ApiResult;

export type AddProjectTeamInput = {
  teamId: string;
};

export type AddProjectTeamResult = ApiResult<{ team: ProjectTeamMember }>;

export type RemoveProjectTeamResult = ApiResult;
