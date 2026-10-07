import type { Metadata } from "next";
import { AcceptInvitationForm } from "@/components/AcceptInvitationForm";
import { AuthLogo } from "@/components/AuthLogo";

export const metadata: Metadata = {
  title: "Accept invitation",
};

type AcceptInvitationPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptInvitationPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="container flex flex-col gap-4 py-8">
        <AuthLogo />
        <h1 className="text-2xl font-semibold text-primary-dark">
          Missing link
        </h1>
        <p className="text-slate-900">
          This page needs the token from the link in your email.
        </p>
      </main>
    );
  }

  return (
    <main className="container flex flex-col gap-8 py-8">
      <AuthLogo />
      <h1 className="text-2xl font-semibold text-primary-dark">
        Join your team
      </h1>
      <AcceptInvitationForm token={token} />
    </main>
  );
}
