import { addTeamMember } from "./addTeamMember";
import type { AddTeamMemberInput } from "@/types/team";

export type AddTeamMembersResult = {
  succeededMembershipIds: string[];
  failed: { membershipId: string; message: string }[];
};

/**
 * Adds several members to a team in one batch — each membership is still
 * its own request against the existing single-member endpoint (no new
 * backend surface), issued in parallel and reported back individually, so
 * one invalid or already-assigned membership doesn't block the rest of the
 * batch from succeeding.
 */
export async function addTeamMembers(
  organisationId: string,
  teamId: string,
  inputs: AddTeamMemberInput[],
): Promise<AddTeamMembersResult> {
  const outcomes = await Promise.all(
    inputs.map(async (input) => ({
      input,
      result: await addTeamMember(organisationId, teamId, input),
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
