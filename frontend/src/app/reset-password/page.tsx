import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { AuthLogo } from "@/components/AuthLogo";

export const metadata: Metadata = {
  title: "Reset password",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="container flex flex-col gap-4 py-8 animate-fade-in-up">
        <AuthLogo />
        <h1 className="text-2xl font-semibold text-primary-dark">
          Reset link expired
        </h1>
        <p className="text-slate-900">
          This link is missing or no longer valid. Request a new one from the{" "}
          <Link
            href="/forgot-password"
            className="text-primary underline transition-colors duration-150 hover:text-primary-dark"
          >
            forgot password
          </Link>{" "}
          page.
        </p>
      </main>
    );
  }

  return (
    <main className="container flex flex-col gap-8 py-8">
      <AuthLogo />
      <h1 className="text-2xl font-semibold text-primary-dark animate-fade-in-up">
        Reset your password
      </h1>
      <div className="animate-fade-in-up-delay">
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
