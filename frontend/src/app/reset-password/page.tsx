import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="container flex flex-col gap-4 py-8">
        <h1 className="text-2xl font-semibold text-primary-dark">
          Reset link expired
        </h1>
        <p className="text-slate-900">
          This link is missing or no longer valid. Request a new one from the{" "}
          <Link href="/forgot-password" className="text-primary underline">
            forgot password
          </Link>{" "}
          page.
        </p>
      </main>
    );
  }

  return (
    <main className="container flex flex-col gap-8 py-8">
      <h1 className="text-2xl font-semibold text-primary-dark">
        Reset your password
      </h1>
      <ResetPasswordForm token={token} />
    </main>
  );
}
