"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ACTIVE_MEMBERS_QUERY_KEY } from "@/hooks/useActiveMembers";
import { updateMembership } from "@/lib/updateMembership";
import type { ActiveMember, MembershipRole } from "@/types/membership";
import { ErrorMessage } from "./ErrorMessage";
import { MemberDisclosureRegionField } from "./MemberDisclosureRegionField";

type MemberRowProps = {
  organisationId: string;
  member: ActiveMember;
  callerRole: MembershipRole;
  callerUserId: string;
  columnCount: number;
};

const ADMIN_ASSIGNABLE_ROLES: MembershipRole[] = ["admin", "manager", "member"];
const MANAGER_ASSIGNABLE_ROLES: MembershipRole[] = ["manager", "member"];

export function MemberRow({
  organisationId,
  member,
  callerRole,
  callerUserId,
  columnCount,
}: MemberRowProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAdmin = callerRole === "admin";
  const isManager = callerRole === "manager";
  const isSelf = member.userId === callerUserId;
  // Nobody — admin included — can change their own role or deactivate
  // their own membership (self-deactivation is a one-way footgun; a
  // deactivated membership can't reactivate itself). Admin access is also
  // off-limits to managers entirely for anyone else — they can't touch a
  // member who's currently admin, and the role options below never offer
  // "admin" as a choice for a manager to grant.
  const canModify =
    !isSelf && (isAdmin || (isManager && member.role !== "admin"));
  const availableRoles = isAdmin
    ? ADMIN_ASSIGNABLE_ROLES
    : MANAGER_ASSIGNABLE_ROLES;

  function invalidateMembers() {
    queryClient.invalidateQueries({
      queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId),
    });
  }

  const roleMutation = useMutation({
    mutationFn: (role: MembershipRole) =>
      updateMembership(organisationId, member.id, { role }),
    onSuccess: (result) => {
      if (result.ok) {
        setErrorMessage(null);
        invalidateMembers();
      } else {
        setErrorMessage(result.message);
      }
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () =>
      updateMembership(organisationId, member.id, { deactivate: true }),
    onSuccess: (result) => {
      if (result.ok) {
        setErrorMessage(null);
        invalidateMembers();
      } else {
        setErrorMessage(result.message);
      }
    },
  });

  const isPending = roleMutation.isPending || deactivateMutation.isPending;

  return (
    <>
      <tr className="border-b border-input-border last:border-b-0">
        <td className="px-3 py-2 text-slate-900">
          {member.name ?? "—"}
          {isSelf && (
            <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              You
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-slate-900">{member.email}</td>
        <td className="px-3 py-2 text-slate-900">
          {canModify ? (
            <select
              value={member.role}
              disabled={isPending}
              onChange={(event) =>
                roleMutation.mutate(event.target.value as MembershipRole)
              }
              className="rounded-md border border-input-border bg-white px-2 py-1 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          ) : isSelf ? (
            <select
              value={member.role}
              disabled
              title="You cannot change your own role"
              className="cursor-not-allowed rounded-md border border-input-border bg-white px-2 py-1 text-slate-900 opacity-50"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          ) : (
            <span className="capitalize">{member.role}</span>
          )}
        </td>
        <td className="px-3 py-2">
          <MemberDisclosureRegionField
            organisationId={organisationId}
            member={member}
            editable={canModify}
          />
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/organisations/${organisationId}/members/${member.id}`}
              className="cursor-pointer rounded-md border border-primary px-3 py-1.5 text-sm text-primary transition-colors duration-150 hover:bg-primary/10"
            >
              View
            </Link>
            {canModify && (
              <button
                type="button"
                onClick={() => deactivateMutation.mutate()}
                disabled={isPending}
                className="cursor-pointer rounded-md border border-error px-3 py-1.5 text-sm text-error transition-colors duration-150 hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Deactivate
              </button>
            )}
            {isSelf && (isAdmin || isManager) && (
              <span
                title="You cannot deactivate your own account"
                className="cursor-not-allowed rounded-md border border-input-border px-3 py-1.5 text-sm text-slate-900/40"
              >
                Deactivate
              </span>
            )}
          </div>
        </td>
      </tr>

      {errorMessage && (
        <tr className="border-b border-input-border last:border-b-0">
          <td colSpan={columnCount} className="px-3 py-2">
            <ErrorMessage message={errorMessage} />
          </td>
        </tr>
      )}
    </>
  );
}
