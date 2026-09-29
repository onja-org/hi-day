"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useInvalidateAssignments } from "@/hooks/useInvalidateAssignments";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { useProjects } from "@/hooks/useProjects";
import { syncMemberAssignments } from "@/lib/syncMemberAssignments";
import type { ActiveMemberListItem } from "@/types/membership";
import { AssignmentChecklist } from "./AssignmentChecklist";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type EditMemberAssignmentsModalProps = {
  organisationId: string;
  member: ActiveMemberListItem;
  onClose: () => void;
};

/** A member's teams and projects in one place. Only teams/projects the
 * caller can see are listed, and only those are changed on save. */
export function EditMemberAssignmentsModal({
  organisationId,
  member,
  onClose,
}: EditMemberAssignmentsModalProps) {
  const organisationQuery = useCurrentOrganisation();
  const teamsQuery = useOrganisationTeams(organisationId);
  const projectsQuery = useProjects(organisationId, { status: "active" });
  const invalidate = useInvalidateAssignments(organisationId);
  const teams = teamsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const originalTeamIds = member.teamIds.filter((id) => teams.some((team) => team.id === id));
  const originalProjectIds = member.projectIds.filter((id) => projects.some((p) => p.id === id));
  const [teamIds, setTeamIds] = useState<Set<string> | null>(null);
  const [projectIds, setProjectIds] = useState<Set<string> | null>(null);
  const selectedTeamIds = teamIds ?? new Set(originalTeamIds);
  const selectedProjectIds = projectIds ?? new Set(originalProjectIds);

  const isAdmin = organisationQuery.data?.role === "admin";
  const callerUserId = organisationQuery.data?.userId;
  // Team rosters are editable by an admin or that team's own manager.
  const canEditTeam = (teamId: string) =>
    isAdmin ||
    (teams
      .find((team) => team.id === teamId)
      ?.members.some((m) => m.userId === callerUserId && m.isManager) ??
      false);

  const names = new Map([...teams, ...projects].map((item) => [item.id, item.name]));
  const mutation = useMutation({
    mutationFn: async () => {
      const { failures } = await syncMemberAssignments(
        organisationId,
        member.id,
        { original: originalTeamIds, target: [...selectedTeamIds] },
        { original: originalProjectIds, target: [...selectedProjectIds] },
        (id) => names.get(id) ?? "item",
      );
      return failures.length === 0
        ? { ok: true, message: "Teams and projects updated", failures }
        : { ok: false, message: `${failures.length} change(s) couldn't be saved`, failures };
    },
    onSuccess: (result) => {
      invalidate();
      if (result.ok) onClose();
    },
  });
  const failures = mutation.data?.failures ?? [];
  const isLoading = teamsQuery.isLoading || projectsQuery.isLoading || organisationQuery.isLoading;

  return (
    <Modal title={`Teams & projects · ${member.name ?? member.email}`} onClose={onClose} size="wide">
      {isLoading ? (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading…
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <AssignmentChecklist
              title="Teams"
              items={teams.map((team) => ({
                id: team.id,
                name: team.name,
                disabledReason: canEditTeam(team.id) ? undefined : "Only this team's manager or an admin can change it",
              }))}
              selectedIds={selectedTeamIds}
              onChange={setTeamIds}
              emptyText="No teams to choose from."
            />
            <AssignmentChecklist
              title="Projects"
              items={projects.map((project) => ({ id: project.id, name: project.name }))}
              selectedIds={selectedProjectIds}
              onChange={setProjectIds}
              emptyText="No active projects to choose from."
            />
          </div>

          {failures.map((failure) => (
            <ErrorMessage key={failure} message={failure} />
          ))}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md border border-input-border px-4 py-2 text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending && <Spinner />}
              Save
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
