"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ACTIVE_MEMBERS_QUERY_KEY, useActiveMembers } from "@/hooks/useActiveMembers";
import { updateMembership } from "@/lib/updateMembership";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type ActiveMembersTableProps = {
  organisationId: string;
};

export function ActiveMembersTable({ organisationId }: ActiveMembersTableProps) {
  const queryClient = useQueryClient();
  const membersQuery = useActiveMembers(organisationId);

  const deactivateMutation = useMutation({
    mutationFn: (membershipId: string) =>
      updateMembership(organisationId, membershipId, { deactivate: true }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId),
      }),
  });

  if (membersQuery.isLoading) {
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

  return (
    <div className="overflow-x-auto rounded-md border border-input-border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-slate-900">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {membersQuery.data.map((member) => (
            <tr key={member.id} className="border-b border-input-border last:border-b-0">
              <td className="px-3 py-2 text-slate-900">{member.name ?? "—"}</td>
              <td className="px-3 py-2 text-slate-900">{member.email}</td>
              <td className="px-3 py-2 text-slate-900 capitalize">{member.role}</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => deactivateMutation.mutate(member.id)}
                  disabled={deactivateMutation.isPending}
                  className="cursor-pointer text-error underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Deactivate
                </button>
              </td>
            </tr>
          ))}
          {membersQuery.data.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-slate-900">
                No active members yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
