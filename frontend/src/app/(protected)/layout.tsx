import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { hasSessionCookie } from "@/lib/hasSessionCookie";
import { isAuthenticated } from "@/lib/isAuthenticated";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isAuthenticated())) {
    // A cookie that no longer works means the session ended underneath the
    // user; say so instead of dropping them on the landing page unexplained.
    redirect((await hasSessionCookie()) ? "/login?reason=session-ended" : "/");
  }

  return children;
}
