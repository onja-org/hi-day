"use client";

import type { ReactNode } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { ErrorMessage } from "./ErrorMessage";
import { InfoMessage } from "./InfoMessage";
import { Spinner } from "./Spinner";

type RequireProjectsEnabledProps = {
  children: ReactNode;
};

/** Shows the Project and Task pages only to an organisation that tracks
 * time against Projects; anyone landing on one by link gets told why it's
 * empty instead of a page whose every request is refused. */
export function RequireProjectsEnabled({ children }: RequireProjectsEnabledProps) {
  const organisationQuery = useCurrentOrganisation();

  if (organisationQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (organisationQuery.isError || !organisationQuery.data) {
    return <ErrorMessage message="Could not load this organisation." />;
  }

  if (!organisationQuery.data.projectsEnabled) {
    return (
      <InfoMessage
        message={
          organisationQuery.data.role === "admin"
            ? "Projects are turned off for this organisation. Turn them on under Settings → Organization → Company information."
            : "Projects are turned off for this organisation. Ask an admin if you need them."
        }
      />
    );
  }

  return <>{children}</>;
}
