"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { login } from "@/lib/login";
import { consumeResetEmailSent } from "@/lib/resetEmailSentNotice";
import { ErrorMessage } from "./ErrorMessage";
import { PasswordInput } from "./PasswordInput";
import { Spinner } from "./Spinner";
import { SuccessMessage } from "./SuccessMessage";

const REDIRECT_DELAY_MS = 900;
const RESET_EMAIL_SENT_MESSAGE = "Email sent with password reset instructions.";

export function LoginForm() {
  const router = useRouter();
  const [resetEmailSent] = useState(() => consumeResetEmailSent());
  const mutation = useMutation({ mutationFn: login });

  useEffect(() => {
    if (!mutation.data?.ok) return;

    const timeout = setTimeout(
      () => router.push("/dashboard"),
      REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [mutation.data, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    mutation.mutate({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-4xl md:px-20 lg:px-0 flex-col gap-6"
    >
      {!mutation.data && resetEmailSent && (
        <SuccessMessage message={RESET_EMAIL_SENT_MESSAGE} />
      )}
      {mutation.data?.ok && <SuccessMessage message={mutation.data.message} />}
      {mutation.data && !mutation.data.ok && (
        <ErrorMessage message={mutation.data.message} />
      )}

      <label className="flex flex-col gap-1.5">
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={mutation.data?.ok}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
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
        className="flex items-center justify-center gap-2 cursor-pointer rounded-md px-4 py-2 text-white transition-colors duration-150 bg-primary/90"
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
