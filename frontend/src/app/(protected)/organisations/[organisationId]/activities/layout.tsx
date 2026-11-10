import type { ReactNode } from "react";
import { RequireOwnActivityAccess } from "@/components/RequireOwnActivityAccess";

type ActivitiesLayoutProps = {
  children: ReactNode;
  params: Promise<{ organisationId: string }>;
};

/**
 * Wraps every Activity tab (apps, URLs, screenshots, notes) in the
 * own-activity visibility guard, so a member whose own activity is switched
 * off is sent back to their dashboard rather than reaching any of them by
 * URL. Admins and team managers pass through unaffected.
 */
export default async function ActivitiesLayout({
  children,
  params,
}: ActivitiesLayoutProps) {
  const { organisationId } = await params;

  return (
    <RequireOwnActivityAccess organisationId={organisationId}>
      {children}
    </RequireOwnActivityAccess>
  );
}
