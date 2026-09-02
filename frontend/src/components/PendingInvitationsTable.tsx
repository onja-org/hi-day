"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  PENDING_INVITATIONS_QUERY_KEY,
  usePendingInvitations,
} from "@/hooks/usePendingInvitations";
import { resendInvitation } from "@/lib/resendInvitation";
import { revokeInvitation } from "@/lib/revokeInvitation";
import type { InvitationStatus } from "@/types/invitation";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type PendingInvitationsTableProps = {
  organisationId: string;
};

function statusLabel(status: InvitationStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
    case "accepted":
      return "Accepted";
  }
}

export function PendingInvitationsTable({
  organisationId,
}: PendingInvitationsTableProps) {
  const queryClient = useQueryClient();
  const invitationsQuery = usePendingInvitations(organisationId);

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) =>
      resendInvitation(organisationId, invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: PENDING_INVITATIONS_QUERY_KEY(organisationId),
      }),
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      revokeInvitation(organisationId, invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: PENDING_INVITATIONS_QUERY_KEY(organisationId),
      }),
  });

  if (invitationsQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading invitations…
      </p>
    );
  }

  if (invitationsQuery.isError || !invitationsQuery.data) {
    return (
      <ErrorMessage
        message={
          invitationsQuery.error instanceof Error
            ? invitationsQuery.error.message
            : "Could not load invitations."
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-input-border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-slate-900">
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {invitationsQuery.data.map((invitation) => (
            <tr key={invitation.id} className="border-b border-input-border last:border-b-0">
              <td className="px-3 py-2 text-slate-900">{invitation.email}</td>
              <td className="px-3 py-2 text-slate-900 capitalize">{invitation.role}</td>
              <td className="px-3 py-2">
                <span
                  className={clsx(
                    invitation.status === "pending" && "text-primary-dark",
                    (invitation.status === "expired" ||
                      invitation.status === "revoked") &&
                      "text-error",
                  )}
                >
                  {statusLabel(invitation.status)}
                </span>
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => resendMutation.mutate(invitation.id)}
                  disabled={resendMutation.isPending}
                  className="cursor-pointer text-primary underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Resend
                </button>
                {invitation.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => revokeMutation.mutate(invitation.id)}
                    disabled={revokeMutation.isPending}
                    className="ml-3 cursor-pointer text-error underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
          {invitationsQuery.data.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-slate-900">
                No pending invitations.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
