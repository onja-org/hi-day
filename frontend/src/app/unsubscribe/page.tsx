import type { Metadata } from "next";
import { AuthLogo } from "@/components/AuthLogo";
import { UnsubscribeSummaryEmail } from "@/components/UnsubscribeSummaryEmail";

export const metadata: Metadata = {
  title: "Turn off summary email",
};

type UnsubscribePageProps = {
  searchParams: Promise<{ token?: string }>;
};

/** Where "Turn off this email" in a summary email lands — no sign-in
 * needed, the link's token is the proof. */
export default async function UnsubscribePage({
  searchParams,
}: UnsubscribePageProps) {
  const { token } = await searchParams;

  return (
    <main className="container flex flex-col gap-8 py-8">
      <AuthLogo />
      <h1 className="animate-fade-in-up text-2xl font-semibold text-primary-dark">
        Turn off summary email
      </h1>
      <div className="animate-fade-in-up-delay">
        {token ? (
          <UnsubscribeSummaryEmail token={token} />
        ) : (
          <p className="text-slate-900">
            This link is missing its code. Use the link from the email again,
            or manage your summary emails from your account page.
          </p>
        )}
      </div>
    </main>
  );
}
