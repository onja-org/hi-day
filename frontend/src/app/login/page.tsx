import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isAuthenticated } from "@/lib/isAuthenticated";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-col lg:flex-row">
      <div className="px-5 sm:px-10 lg:px-20 flex lg:w-2/5 min-h-screen flex-col justify-center gap-8 py-20">
        <h2 className="text-3xl font-semibold">Welcome back.</h2>
        <p className="text-slate-900">
          Log in to keep tracking time and stay on top of your team&apos;s
          activity.
        </p>
        <LoginForm />
      </div>

      <aside className="hidden shrink-0 flex-col justify-center gap-4 bg-primary-dark px-12 py-16 text-white lg:flex flex-1 ">

          <h2 className="text-3xl font-semibold">Welcome back.</h2>
        <p className="text-white/80">
          Log in to keep tracking time and stay on top of your team&apos;s
          activity.
        </p>
      </aside>
    </main>
  );
}
