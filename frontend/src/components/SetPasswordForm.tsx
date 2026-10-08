"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { FormEvent } from "react";
import { setPassword } from "@/lib/setPassword";
import { PasswordField } from "@/components/ui/form/PasswordField";
import { Spinner } from "@/components/Spinner";

const REDIRECT_DELAY_MS = 900;

type SetPasswordFormProps = {
  token: string;
};

export function SetPasswordForm({ token }: SetPasswordFormProps) {
  const router = useRouter();
  const mutation = useMutation({ mutationFn: setPassword });

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
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    mutation.mutate({ token, password });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-4xl flex-col gap-6"
    >
      <PasswordField
        label="Password"
        hint="At least 6 characters, including a letter and a number."
        name="password"
        autoComplete="new-password"
        required
        minLength={6}
        pattern="(?=.*[A-Za-z])(?=.*\d).{6,}"
        title="At least 6 characters, including a letter and a number"
        disabled={mutation.data?.ok}
      />

      <button
        type="submit"
        disabled={mutation.isPending || mutation.data?.ok}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50 border-2 border-ink font-bold"
      >
        {mutation.isPending && <Spinner />}
        {mutation.isPending ? "Setting password…" : "Set password"}
      </button>
    </form>
  );
}
