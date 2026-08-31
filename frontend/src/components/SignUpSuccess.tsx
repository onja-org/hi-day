"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { resendVerification } from "@/lib/resendVerification";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { SuccessMessage } from "./SuccessMessage";

type SignUpSuccessProps = {
  email: string;
};

export function SignUpSuccess({ email }: SignUpSuccessProps) {
  const mutation = useMutation({ mutationFn: resendVerification });

  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-primary p-6">
      <CheckCircle size={32} className="text-primary" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-primary-dark">
        Verify your email
      </h1>
      <p className="text-slate-900">
        You&apos;re in. An email has been sent to{" "}
        <span className="font-semibold">{email}</span>. Hit confirm and
        you&apos;ll be ready to start working.
      </p>

      {mutation.data?.ok && <SuccessMessage message={mutation.data.message} />}
      {mutation.data && !mutation.data.ok && (
        <ErrorMessage message={mutation.data.message} />
      )}

      <div className="flex w-full flex-col items-start gap-3 border-t border-primary-dark/20 pt-4">
        <p className="text-slate-900">Didn&apos;t see an email?</p>
        <button
          type="button"
          onClick={() => mutation.mutate({ email })}
          disabled={mutation.isPending}
          className="flex items-center justify-center gap-2 rounded-md border border-primary px-4 py-2 text-primary transition-colors duration-150 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending && <Spinner />}
          {mutation.isPending ? "Resending…" : "Resend verification email"}
        </button>

        <Link
          href="/login"
          className="cursor-pointer text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-dark hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </section>
  );
}
