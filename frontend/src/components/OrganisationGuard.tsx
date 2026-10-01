"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { ErrorMessage } from "./ErrorMessage";
import { OrganisationSuspendedNotice } from "./OrganisationSuspendedNotice";
import { Spinner } from "./Spinner";

type OrganisationGuardProps = {
  organisationId: number;
  children: ReactNode;
};

/**
 * Guards every page under an /:organisationId/ route segment. The backend
 * never trusts this id for data access (every query is still scoped to the
 * caller's session), so this is a UX safeguard, not a security boundary: a
 * stale link or a manually-edited id gets silently corrected to the
 * caller's real organisation instead of rendering the wrong context.
 */
export function OrganisationGuard({
  organisationId,
  children,
}: OrganisationGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const organisationQuery = useCurrentOrganisation();
  const actualId = organisationQuery.data?.id;
  const isWrongOrganisation =
    actualId !== undefined && actualId !== organisationId;

  useEffect(() => {
    if (isWrongOrganisation && actualId !== undefined) {
      router.replace(pathname.replace(`/${organisationId}/`, `/${actualId}/`));
    }
  }, [isWrongOrganisation, actualId, organisationId, pathname, router]);

  if (organisationQuery.isLoading || isWrongOrganisation) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (organisationQuery.isError || !organisationQuery.data) {
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not load your organisation."
        }
      />
    );
  }

  if (organisationQuery.data.suspendedAt) {
    return <OrganisationSuspendedNotice organisation={organisationQuery.data} />;
  }

  return <>{children}</>;
}
