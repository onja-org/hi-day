"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAssignableProjectMembers } from "@/hooks/useAssignableProjectMembers";
import { useAssignableProjectTeams } from "@/hooks/useAssignableProjectTeams";
import { useInvalidateProjects } from "@/hooks/useInvalidateProjects";
import { PROJECT_MEMBERSHIP_ROLE_OPTIONS } from "@/lib/projectMembershipRoleOptions";
import { applyProjectBatchEdit } from "@/lib/applyProjectBatchEdit";
import { runProjectBatch } from "@/lib/runProjectBatch";
import type { ProjectColour, ProjectMembershipRole, ProjectOverviewItem } from "@/types/project";
import { CheckboxDropdownField } from "./CheckboxDropdownField";
import { Modal } from "./Modal";
import { ProjectBatchResultsList } from "./ProjectBatchResultsList";
import { ProjectColourPicker } from "./ProjectColourPicker";
import { Spinner } from "./Spinner";

type BatchEditProjectsModalProps = {
  organisationId: string;
  projects: ProjectOverviewItem[];
  onClose: () => void;
  onDone: () => void;
};

export function BatchEditProjectsModal({
  organisationId,
  projects,
  onClose,
  onDone,
}: BatchEditProjectsModalProps) {
  const invalidateProjects = useInvalidateProjects(organisationId);
  const teamsQuery = useAssignableProjectTeams(organisationId);
  const membersQuery = useAssignableProjectMembers(organisationId);
  const [colour, setColour] = useState<ProjectColour | null>(null);
  const [teamIds, setTeamIds] = useState<Set<string>>(new Set());
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [memberRole, setMemberRole] = useState<ProjectMembershipRole>("member");
  const hasChanges = colour !== null || teamIds.size > 0 || memberIds.size > 0;

  const mutation = useMutation({
    mutationFn: () =>
      runProjectBatch(projects, (project) =>
        applyProjectBatchEdit(organisationId, project, {
          colour: colour ?? undefined,
          teamIds: [...teamIds],
          memberIds: [...memberIds],
          memberRole,
        }),
        "Updated",
      ),
    onSettled: () => {
      invalidateProjects();
      onDone();
    },
  });

  return (
    <Modal title={`Edit ${projects.length} ${projects.length === 1 ? "project" : "projects"}`} onClose={onClose}>
      {mutation.data ? (
        <ProjectBatchResultsList outcomes={mutation.data.outcomes} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-900">
            Only what you set here changes. Teams and members are added alongside anyone
            already on each project.
          </p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-slate-900">Colour</legend>
            <label className="flex items-center gap-2 text-sm text-slate-900">
              <input
                type="checkbox"
                checked={colour !== null}
                onChange={(event) => setColour(event.target.checked ? "blue" : null)}
                className="accent-primary"
              />
              Change colour
            </label>
            {colour && <ProjectColourPicker value={colour} onChange={setColour} />}
          </fieldset>
          <CheckboxDropdownField
            id="batch-edit-teams"
            label="Add teams"
            items={teamsQuery.data ?? []}
            selectedIds={teamIds}
            onChange={setTeamIds}
            noun={["team", "teams"]}
            isLoading={teamsQuery.isLoading}
          />
          <CheckboxDropdownField
            id="batch-edit-members"
            label="Add members"
            items={(membersQuery.data ?? []).map((member) => ({
              id: member.id,
              name: member.name ?? member.email,
            }))}
            selectedIds={memberIds}
            onChange={setMemberIds}
            noun={["member", "members"]}
            isLoading={membersQuery.isLoading}
          />
          {memberIds.size > 0 && (
            <label className="flex flex-col gap-1.5 text-slate-900">
              Role for added members
              <select
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value as ProjectMembershipRole)}
                className="rounded-md border border-input-border bg-white px-3 h-11 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {PROJECT_MEMBERSHIP_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-md border border-input-border px-4 h-11 text-slate-900"
        >
          {mutation.data ? "Done" : "Cancel"}
        </button>
        {!mutation.data && (
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!hasChanges || mutation.isPending}
            className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending && <Spinner />}
            Apply changes
          </button>
        )}
      </div>
    </Modal>
  );
}
