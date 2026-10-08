"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { LoginInput } from "@/types/login";
import { login } from "@/lib/login";
import { consumeResetEmailSent } from "@/lib/resetEmailSentNotice";
import { PasswordField } from "@/components/ui/form/PasswordField";
import { TextField } from "@/components/ui/form/TextField";
import { RobotCheckScreen } from "@/components/RobotCheckScreen";
import { Spinner } from "@/components/Spinner";
import { SuccessMessage } from "@/components/SuccessMessage";

const REDIRECT_DELAY_MS = 900;
const RESET_EMAIL_SENT_MESSAGE = "Email sent with password reset instructions.";

type LoginFormProps = {
  next?: string;
};

export function LoginForm({ next = "/dashboard" }: LoginFormProps) {
  const router = useRouter();
  const [resetEmailSent, setResetEmailSent] = useState(() =>
    consumeResetEmailSent(),
  );
  const [lastEmail, setLastEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const mutation = useMutation({ mutationFn: login });
  const captchaRequired = Boolean(
    mutation.data && !mutation.data.ok && mutation.data.captchaRequired,
  );

  useEffect(() => {
    if (!mutation.data?.ok) return;

    const timeout = setTimeout(() => router.push(next), REDIRECT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [mutation.data, next, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetEmailSent(false);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    setLastEmail(email);

    const input: LoginInput = {
      email,
      password: String(formData.get("password") ?? ""),
      captchaToken: captchaToken ?? undefined,
    };

    if (captchaToken) setVerifying(true);
    mutation.mutate(input, {
      onSettled: () => {
        setCaptchaToken(null);
        setVerifying(false);
      },
    });
  }

  if (verifying) {
    return (
      <div className="animate-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-primary-dark text-white">
        <Spinner className="h-8 w-8" />
        <p>Verifying…</p>
      </div>
    );
  }

  if (captchaRequired && !captchaToken) {
    return (
      <RobotCheckScreen
        onVerified={(token) => {
          mutation.reset();
          setCaptchaToken(token);
        }}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-4xl md:px-20 lg:px-0 flex-col gap-6"
    >
      {!mutation.data && resetEmailSent && (
        <SuccessMessage message={RESET_EMAIL_SENT_MESSAGE} />
      )}

      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        required
        defaultValue={lastEmail}
        disabled={mutation.data?.ok}
      />

      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        disabled={mutation.data?.ok}
      />

      <Link
        href="/forgot-password"
        className="cursor-pointer self-start text-sm text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-dark hover:underline"
      >
        Forgot password?
      </Link>

      <button
        type="submit"
        disabled={mutation.isPending || mutation.data?.ok}
        className="flex items-center justify-center gap-2 cursor-pointer rounded-brand-sm border-2 border-ink px-4 h-11 text-white transition-all duration-150 bg-primary/90 hover:scale-105 hover:bg-primary active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100 font-bold"
      >
        {mutation.isPending && <Spinner />}
        {mutation.isPending ? "Logging in…" : "Log in"}
      </button>

      <p className="text-slate-900">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="cursor-pointer underline text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-dark hover:underline"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
