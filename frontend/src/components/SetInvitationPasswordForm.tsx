import type { FormEvent } from "react";
import type { AcceptInvitationInput, AcceptInvitationResult } from "@/types/invitation";
import { PasswordInput } from "./PasswordInput";
import { Spinner } from "./Spinner";

type SetInvitationPasswordFormProps = {
  organisationName: string;
  role: string;
  result: AcceptInvitationResult | undefined;
  isPending: boolean;
  onSubmit: (input: AcceptInvitationInput) => void;
};

export function SetInvitationPasswordForm({
  organisationName,
  role,
  result,
  isPending,
  onSubmit,
}: SetInvitationPasswordFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit({
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-6">
      <p className="text-slate-900">
        Join {organisationName} as {role}.
      </p>

      <label className="flex flex-col gap-1.5">
        First name
        <input
          name="firstName"
          type="text"
          required
          disabled={result?.ok}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Last name
        <input
          name="lastName"
          type="text"
          required
          disabled={result?.ok}
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Password
        <PasswordInput
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
          pattern="(?=.*[A-Za-z])(?=.*\d).{6,}"
          title="At least 6 characters, including a letter and a number"
          disabled={result?.ok}
        />
        <span className="text-sm text-slate-900">
          At least 6 characters, including a letter and a number.
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending || result?.ok}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
      >
        {isPending && <Spinner />}
        {isPending ? "Joining…" : "Set password & join"}
      </button>
    </form>
  );
}
