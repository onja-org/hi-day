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
  client: string | null;
  description: string | null;
  colour: ProjectColour;
  billable: boolean;
  rate: string | null;
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
  rate: string | null;
  effectiveRate: string | null;
};

export type ProjectDetail = Project & {
  members: ProjectMember[];
};

export type ProjectListItem = Project & {
  taskCount: number;
};

export type ProjectFormInput = {
  name: string;
  client?: string;
  description?: string;
  colour?: ProjectColour;
  billable?: boolean;
  rate?: string;
};

export type GetProjectsResult =
  | { ok: true; projects: ProjectListItem[] }
  | { ok: false; message: string };

export type GetProjectResult =
  | { ok: true; project: ProjectDetail }
  | { ok: false; message: string };

export type CreateProjectResult =
  | { ok: true; project: Project }
  | { ok: false; message: string };

export type UpdateProjectResult =
  | { ok: true; project: Project }
  | { ok: false; message: string };

export type ArchiveProjectResult =
  | { ok: true; project: Project }
  | { ok: false; message: string };

export type AddProjectMemberInput = {
  membershipId: string;
  rate?: string;
  role?: ProjectMembershipRole;
};

export type AddProjectMemberResult =
  | { ok: true; member: ProjectMember }
  | { ok: false; message: string };

export type UpdateProjectMemberInput = {
  role?: ProjectMembershipRole;
  rate?: string;
};

export type UpdateProjectMemberResult =
  | { ok: true; member: ProjectMember }
  | { ok: false; message: string };

export type RemoveProjectMemberResult =
  | { ok: true }
  | { ok: false; message: string };
