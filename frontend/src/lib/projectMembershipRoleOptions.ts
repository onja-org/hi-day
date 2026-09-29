import type { ProjectMembershipRole } from "@/types/project";

/** Every role pickable when putting someone on a project, in picker order. */
export const PROJECT_MEMBERSHIP_ROLE_OPTIONS: { value: ProjectMembershipRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "manager", label: "Manager" },
  { value: "viewer", label: "Viewer" },
];
