"use client";

import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { ErrorMessage } from "./ErrorMessage";
import { MemberRow } from "./MemberRow";
import { Spinner } from "./Spinner";

type ActiveMembersTableProps = {
  organisationId: string;
};

const COLUMN_COUNT = 5;

export function ActiveMembersTable({ organisationId }: ActiveMembersTableProps) {
  const membersQuery = useActiveMembers(organisationId);
  const organisationQuery = useCurrentOrganisation();

  if (membersQuery.isLoading || organisationQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading members…
      </p>
    );
  }

  if (membersQuery.isError || !membersQuery.data) {
    return (
      <ErrorMessage
        message={
          membersQuery.error instanceof Error
            ? membersQuery.error.message
            : "Could not load members."
        }
      />
    );
  }

  if (organisationQuery.isError || !organisationQuery.data) {
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not verify access."
        }
      />
    );
  }

  const callerRole = organisationQuery.data.role;
  const callerUserId = organisationQuery.data.userId;

  return (
    <div className="overflow-x-auto rounded-md border border-input-border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-slate-900">
            <th className="px-3 py-2 font-medium" />
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {membersQuery.data.map((member) => (
            <MemberRow
              key={member.id}
              organisationId={organisationId}
              member={member}
              callerRole={callerRole}
              callerUserId={callerUserId}
              columnCount={COLUMN_COUNT}
            />
          ))}
          {membersQuery.data.length === 0 && (
            <tr>
              <td
                colSpan={COLUMN_COUNT}
                className="px-3 py-4 text-center text-slate-900"
              >
                No active members yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
