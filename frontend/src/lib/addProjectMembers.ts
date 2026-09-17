import { addProjectMember } from "./addProjectMember";
import type { AddProjectMemberInput } from "@/types/project";

export type AddProjectMembersResult = {
  succeededMembershipIds: string[];
  failed: { membershipId: string; message: string }[];
};

/**
 * Adds several members to a project in one batch — each membership is still
 * its own request against the existing single-member endpoint (no new
 * backend surface), issued in parallel and reported back individually, so
 * one invalid or already-assigned membership doesn't block the rest of the
 * batch from succeeding.
 */
export async function addProjectMembers(
  organisationId: string,
  projectId: string,
  inputs: AddProjectMemberInput[],
): Promise<AddProjectMembersResult> {
  const outcomes = await Promise.all(
    inputs.map(async (input) => ({
      input,
      result: await addProjectMember(organisationId, projectId, input),
    })),
  );

  const succeededMembershipIds: string[] = [];
  const failed: { membershipId: string; message: string }[] = [];

  for (const { input, result } of outcomes) {
    if (result.ok) {
      succeededMembershipIds.push(input.membershipId);
    } else {
      failed.push({ membershipId: input.membershipId, message: result.message });
    }
  }

  return { succeededMembershipIds, failed };
}
