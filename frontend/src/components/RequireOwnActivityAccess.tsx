"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type RequireOwnActivityAccessProps = {
  organisationId: string;
  children: ReactNode;
};

/**
 * Gates the Activity pages for a member whose own activity has been switched
 * off (see the "Members can see their own activity" setting). The sidebar
 * already hides the Activity link for them, so this is defence-in-depth for
 * a typed or bookmarked URL — it sends them back to their dashboard rather
 * than showing an empty page that would hint the data exists. Admins and
 * team managers always have `canViewOwnActivity` true, so they pass through
 * and keep using the page to view the people they oversee.
 */
export function RequireOwnActivityAccess({
  organisationId,
  children,
}: RequireOwnActivityAccessProps) {
  const organisationQuery = useCurrentOrganisation();
  const router = useRouter();
  const blocked =
    organisationQuery.data !== undefined &&
    !organisationQuery.data.canViewOwnActivity;

  useEffect(() => {
    if (blocked) {
      router.replace(`/dashboard/${organisationId}/me`);
    }
  }, [blocked, organisationId, router]);

  if (organisationQuery.isLoading) {
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
            : "Could not load this page."
        }
      />
    );
  }

  // Render nothing while the redirect above takes effect — never the page.
  if (blocked) {
    return null;
  }

  return <>{children}</>;
}
