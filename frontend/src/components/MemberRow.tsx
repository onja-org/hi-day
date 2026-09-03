"use client";

import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ACTIVE_MEMBERS_QUERY_KEY } from "@/hooks/useActiveMembers";
import { updateMembership } from "@/lib/updateMembership";
import type { ActiveMember, MembershipRole } from "@/types/membership";
import { ErrorMessage } from "./ErrorMessage";
import { MemberActivityRow } from "./MemberActivityRow";

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
  const [expanded, setExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAdmin = callerRole === "admin";
  const isManager = callerRole === "manager";
  const isSelf = member.userId === callerUserId;
  // Admin access is off-limits to managers entirely — they can't touch a
  // member who's currently admin, and the role options below never offer
  // "admin" as a choice for a manager to grant. A manager also can't
  // modify their own membership (self role-change/deactivate is a one-way
  // footgun — a deactivated membership can't reactivate itself).
  const canModify =
    isAdmin || (isManager && member.role !== "admin" && !isSelf);
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
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={
              expanded ? "Collapse member activity" : "Expand member activity"
            }
            className="cursor-pointer text-primary-dark"
          >
            {expanded ? (
              <CaretDown size={16} aria-hidden="true" />
            ) : (
              <CaretRight size={16} aria-hidden="true" />
            )}
          </button>
        </td>
        <td className="px-3 py-2 text-slate-900">{member.name ?? "—"}</td>
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
          ) : (
            <span className="capitalize">{member.role}</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          {canModify && (
            <button
              type="button"
              onClick={() => deactivateMutation.mutate()}
              disabled={isPending}
              className="cursor-pointer text-error underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Deactivate
            </button>
          )}
        </td>
      </tr>

      {errorMessage && (
        <tr className="border-b border-input-border last:border-b-0">
          <td colSpan={columnCount} className="px-3 py-2">
            <ErrorMessage message={errorMessage} />
          </td>
        </tr>
      )}

      {expanded && (
        <MemberActivityRow
          organisationId={organisationId}
          membershipId={member.id}
          colSpan={columnCount}
        />
      )}
    </>
  );
}
