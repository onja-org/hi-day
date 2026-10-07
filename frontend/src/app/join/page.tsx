import type { Metadata } from "next";
import { JoinViaLinkForm } from "@/components/JoinViaLinkForm";
import { AuthLogo } from "@/components/AuthLogo";

export const metadata: Metadata = {
  title: "Join your team",
};

type JoinPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { token } = await searchParams;

  return (
    <main className="container flex flex-col gap-8 py-8">
      <AuthLogo />
      <h1 className="text-2xl font-semibold text-primary-dark">Join your team</h1>
      {token ? (
        <JoinViaLinkForm token={token} />
      ) : (
        <p className="text-slate-900">This page needs the invite link someone shared with you.</p>
      )}
    </main>
  );
}
