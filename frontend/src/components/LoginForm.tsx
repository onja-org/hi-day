"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { LoginInput } from "@/types/login";
import { login } from "@/lib/login";
import { consumeResetEmailSent } from "@/lib/resetEmailSentNotice";
import { PasswordInput } from "./PasswordInput";
import { RobotCheckScreen } from "./RobotCheckScreen";
import { Spinner } from "./Spinner";
import { SuccessMessage } from "./SuccessMessage";

const REDIRECT_DELAY_MS = 900;
const RESET_EMAIL_SENT_MESSAGE = "Email sent with password reset instructions.";

type LoginFormProps = {
  /** Where to go after a successful login — defaults to the dashboard. */
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

      <label className="flex flex-col gap-1.5">
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={lastEmail}
          disabled={mutation.data?.ok}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Password
        <PasswordInput
          name="password"
          autoComplete="current-password"
          required
          disabled={mutation.data?.ok}
        />
      </label>

      <Link
        href="/forgot-password"
        className="cursor-pointer self-start text-sm text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-dark hover:underline"
      >
        Forgot password?
      </Link>

      <button
        type="submit"
        disabled={mutation.isPending || mutation.data?.ok}
        className="flex items-center justify-center gap-2 cursor-pointer rounded-md px-4 py-2 text-white transition-all duration-150 bg-primary/90 hover:scale-105 hover:bg-primary active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
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
