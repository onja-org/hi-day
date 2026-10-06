import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthAside } from "@/components/AuthAside";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { isAuthenticated } from "@/lib/isAuthenticated";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default async function ForgotPasswordPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-col lg:flex-row">
      <div className="px-5 sm:px-10 lg:px-20 flex lg:w-2/5 min-h-screen flex-col justify-center gap-8 py-20">
        <div className="sm:px-20 lg:px-0 animate-fade-in-up">
          <h2 className="text-3xl font-semibold">Forgot your password?</h2>
        </div>
        <div className="animate-fade-in-up-delay">
          <ForgotPasswordForm />
        </div>
      </div>

      <AuthAside variant="dark" />
    </main>
  );
}
