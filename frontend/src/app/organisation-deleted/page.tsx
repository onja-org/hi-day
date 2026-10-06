import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Organisation deleted",
};

/**
 * Where an owner lands after confirming a permanent deletion that erases
 * their own account (ADR-0023). Public: their session has already ended.
 */
export default function OrganisationDeletedPage() {
  return (
    <main className="container flex flex-col gap-4 py-8 animate-fade-in-up">
      <h1 className="text-2xl font-semibold text-primary-dark">
        Your organisation is being deleted
      </h1>
      <p className="text-slate-900">
        Permanent deletion has started, and you have been signed out. Your
        organisation, its data and your user account are erased within
        minutes, and can&rsquo;t be restored.
      </p>
      <p className="text-slate-900">
        You&rsquo;ll receive an email once it&rsquo;s complete, usually within
        minutes and at most an hour.
      </p>
      <Link
        href="/"
        className="w-fit text-primary underline transition-colors duration-150 hover:text-primary-dark"
      >
        Back to the home page
      </Link>
    </main>
  );
}
