import type { FormEvent } from "react";
import type {
  AcceptInvitationInput,
  AcceptInvitationResult,
} from "@/types/invitation";
import { PasswordField } from "@/components/ui/form/PasswordField";
import { TextField } from "@/components/ui/form/TextField";
import { Spinner } from "@/components/Spinner";

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
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-6"
    >
      <p className="text-slate-900">
        Join {organisationName} as {role}.
      </p>

      <TextField
        label="First name"
        name="firstName"
        type="text"
        placeholder="Jane"
        required
        disabled={result?.ok}
      />

      <TextField
        label="Last name"
        name="lastName"
        type="text"
        placeholder="Doe"
        required
        disabled={result?.ok}
      />

      <PasswordField
        label="Password"
        hint="At least 6 characters, including a letter and a number."
        name="password"
        autoComplete="new-password"
        required
        minLength={6}
        pattern="(?=.*[A-Za-z])(?=.*\d).{6,}"
        title="At least 6 characters, including a letter and a number"
        disabled={result?.ok}
      />

      <button
        type="submit"
        disabled={isPending || result?.ok}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50 border-2 border-ink font-bold"
      >
        {isPending && <Spinner />}
        {isPending ? "Joining…" : "Set password & join"}
      </button>
    </form>
  );
}
