"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { resetPassword } from "@/lib/resetPassword";
import { ErrorMessage } from "./ErrorMessage";
import { PasswordInput } from "./PasswordInput";
import { Spinner } from "./Spinner";
import { SuccessMessage } from "./SuccessMessage";

const REDIRECT_DELAY_MS = 900;
const PASSWORD_MISMATCH_MESSAGE = "Passwords do not match.";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const mutation = useMutation({ mutationFn: resetPassword });
  const [mismatchError, setMismatchError] = useState<string | null>(null);

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
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setMismatchError(PASSWORD_MISMATCH_MESSAGE);
      return;
    }

    setMismatchError(null);
    mutation.mutate({ token, password });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-6"
    >
      {mutation.data?.ok && <SuccessMessage message={mutation.data.message} />}
      {!mutation.data?.ok && mismatchError && (
        <ErrorMessage message={mismatchError} />
      )}
      {mutation.data && !mutation.data.ok && (
        <ErrorMessage message={mutation.data.message} />
      )}

      <label className="flex flex-col gap-1.5">
        New password
        <PasswordInput
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
          pattern="(?=.*[A-Za-z])(?=.*\d).{6,}"
          title="At least 6 characters, including a letter and a number"
          disabled={mutation.data?.ok}
        />
        <span className="text-sm text-slate-900">
          At least 6 characters, including a letter and a number.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        Confirm new password
        <PasswordInput
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={6}
          disabled={mutation.data?.ok}
        />
      </label>

      <button
        type="submit"
        disabled={mutation.isPending || mutation.data?.ok}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
      >
        {mutation.isPending && <Spinner />}
        {mutation.isPending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
