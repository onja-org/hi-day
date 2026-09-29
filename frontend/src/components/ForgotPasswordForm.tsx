"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { FormEvent } from "react";
import { forgotPassword } from "@/lib/forgotPassword";
import { markResetEmailSent } from "@/lib/resetEmailSentNotice";
import { TextField } from "@/components/ui/form/TextField";
import { Spinner } from "@/components/Spinner";

export function ForgotPasswordForm() {
  const router = useRouter();
  const mutation = useMutation({ mutationFn: forgotPassword });

  useEffect(() => {
    if (!mutation.data?.ok) return;
    markResetEmailSent();
    router.replace("/login");
  }, [mutation.data, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    mutation.mutate({ email });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full sm:px-20 lg:px-0 flex-col gap-6"
    >
      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        disabled={mutation.data?.ok}
      />

      <button
        type="submit"
        disabled={mutation.isPending || mutation.data?.ok}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-all duration-150 hover:scale-105 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {mutation.isPending && <Spinner />}
        {mutation.isPending ? "Sending…" : "Send instructions"}
      </button>

      <p className="flex justify-center">
        <Link
          href="/login"
          className="flex cursor-pointer items-center gap-2 text-sm text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-dark hover:underline"
        >
          <ArrowLeftIcon size={20} aria-hidden="true" />
          Back to sign in
        </Link>
      </p>

      <p className="text-center text-slate-900">
        Need an account?{" "}
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
