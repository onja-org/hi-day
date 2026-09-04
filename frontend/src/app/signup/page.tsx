import { redirect } from "next/navigation";
import { AuthAside } from "@/components/AuthAside";
import { SignUpForm } from "@/components/SignUpForm";
import { isAuthenticated } from "@/lib/isAuthenticated";

export default async function SignUpPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-col lg:flex-row">
      <div className="px-5 sm:px-10 lg:px-20 flex lg:w-2/5 min-h-screen flex-col justify-center gap-8 py-20">
        <div className="md:px-20 lg:px-0 animate-fade-in-up">
          <h2 className="text-3xl font-semibold">
            Track time. Trust the numbers.
          </h2>
          <p className="text-slate-900">
            Workforce Monitoring gives your team accurate time tracking and your
            organisation the visibility it needs to grow with confidence.
          </p>
        </div>
        <div className="animate-fade-in-up-delay">
          <SignUpForm />
        </div>
      </div>

      <AuthAside
        title="Track time. Trust the numbers."
        description="Workforce Monitoring gives your team accurate time tracking and your organisation the visibility it needs to grow with confidence."
      />
    </main>
  );
}
