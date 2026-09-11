import { redirect } from "next/navigation";
import { AuthAside } from "@/components/AuthAside";
import { LoginForm } from "@/components/LoginForm";
import { isAuthenticated } from "@/lib/isAuthenticated";
import { safeRedirectPath } from "@/lib/safeRedirectPath";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const target = safeRedirectPath(next);

  if (await isAuthenticated()) {
    redirect(target);
  }

  return (
    <main className="flex flex-col lg:flex-row">
      <div className="px-5 sm:px-10 lg:px-20 flex lg:w-2/5 min-h-screen flex-col justify-center gap-8 py-20">
        <div className="md:px-20 lg:px-0 animate-fade-in-up">
          <h2 className="text-3xl font-semibold">Welcome back.</h2>
          <p className="text-slate-900">
            Log in to keep tracking time and stay on top of your team&apos;s
            activity.
          </p>
        </div>
        <div className="animate-fade-in-up-delay md:px-20 lg:px-0">
          <LoginForm next={target} />
        </div>
      </div>

      <AuthAside
        title="Welcome back."
        description="Log in to keep tracking time and stay on top of your team's activity."
      />
    </main>
  );
}
