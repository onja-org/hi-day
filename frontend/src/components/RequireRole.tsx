"use client";

import type { ReactNode } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import type { MembershipRole } from "@/types/membership";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type RequireRoleProps = {
  role: MembershipRole | MembershipRole[];
  children: ReactNode;
};

const DENIED_MESSAGE =
  "You don't have access to this. Contact an admin of your organisation if you believe this is a mistake.";

export function RequireRole({ role, children }: RequireRoleProps) {
  const organisationQuery = useCurrentOrganisation();
  const allowedRoles = Array.isArray(role) ? role : [role];

  if (organisationQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Checking access…
      </p>
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

  if (!allowedRoles.includes(organisationQuery.data.role)) {
    return <ErrorMessage message={DENIED_MESSAGE} />;
  }

  return <>{children}</>;
}
