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

/** A `viewer` can see the project (and, once they exist, its team reports)
 * but can't log time against it or be assigned its tasks. */
export type ProjectMembershipRole = "manager" | "member" | "viewer";

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

/** A Projects-page row — see the backend's ProjectOverviewItem. */
export type ProjectOverviewItem = ProjectListItem & {
  members: ProjectMember[];
  teams: ProjectTeamMember[];
};

export type TimeTrackingProjectListItem = ProjectListItem & {
  /** Whether the caller may attribute a manually-logged entry on this
   * project to someone other than themselves — an org admin/manager, or a
   * project-level `manager` on this project specifically. */
  canLogTimeForOthers: boolean;
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
  | { ok: true; projects: ProjectOverviewItem[] }
  | { ok: false; message: string };

export type GetMyProjectsResult =
  | { ok: true; projects: TimeTrackingProjectListItem[] }
  | { ok: false; message: string };

export type GetProjectResult =
  | { ok: true; project: ProjectDetail }
  | { ok: false; message: string };

export type CreateProjectResult = ApiResult<{ project: Project }>;

export type UpdateProjectResult = ApiResult<{ project: Project }>;

export type ArchiveProjectResult = ApiResult<{ project: Project }>;

export type DeleteProjectResult = ApiResult;

/** One project's outcome in a batch action (archive, delete, edit). */
export type ProjectBatchOutcome = {
  projectId: string;
  name: string;
  ok: boolean;
  message: string;
};

/** What a batch edit applies to every selected project — anything already
 * on a project is left as is. */
export type ProjectBatchEdit = {
  colour?: ProjectColour;
  teamIds: string[];
  memberIds: string[];
  memberRole: ProjectMembershipRole;
};

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
