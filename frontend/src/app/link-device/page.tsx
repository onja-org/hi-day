import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DevicePairingApproval } from "@/components/DevicePairingApproval";
import { isAuthenticated } from "@/lib/isAuthenticated";
import { AuthLogo } from "@/components/AuthLogo";

export const metadata: Metadata = {
  title: "Link the desktop app",
};

type LinkDevicePageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function LinkDevicePage({
  searchParams,
}: LinkDevicePageProps) {
  const { code } = await searchParams;

  if (!code) {
    return (
      <main className="container flex flex-col gap-4 py-8">
        <AuthLogo />
        <h1 className="text-2xl font-semibold text-primary-dark">
          Missing link
        </h1>
        <p className="text-slate-900">
          This page needs the code from the desktop app — open it from
          there rather than typing the URL directly.
        </p>
      </main>
    );
  }

  // The desktop app only ever gets here by opening this exact URL in the
  // system browser — a next-param round trip through /login preserves the
  // code across that login step, rather than losing it to the generic
  // (protected) layout's redirect to "/".
  if (!(await isAuthenticated())) {
    redirect(`/login?next=${encodeURIComponent(`/link-device?code=${code}`)}`);
  }

  return (
    <main className="container flex flex-col gap-8 py-8">
      <AuthLogo />
      <h1 className="text-2xl font-semibold text-primary-dark">
        Log in to the desktop app
      </h1>
      <DevicePairingApproval code={code} />
    </main>
  );
}
