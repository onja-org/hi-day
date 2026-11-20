import type { FormEvent } from "react";
import Link from "next/link";
import type {
  AcceptInvitationInput,
  AcceptInvitationResult,
} from "@/types/invitation";
import { PasswordField } from "@/components/ui/form/PasswordField";
import { Spinner } from "./Spinner";

type JoinExistingAccountViewProps = {
  email: string;
  organisationName: string;
  result: AcceptInvitationResult | undefined;
  isPending: boolean;
  onJoin: (input: AcceptInvitationInput) => void;
};

// The password is what lets someone who can't log in join — a former
// member being re-invited, whom login refuses while they're deactivated.
// Someone already logged in as this email can leave it blank.
export function JoinExistingAccountView({
  email,
  organisationName,
  result,
  isPending,
  onJoin,
}: JoinExistingAccountViewProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentPassword = String(
      new FormData(event.currentTarget).get("currentPassword") ?? "",
    );
    onJoin(currentPassword ? { currentPassword } : {});
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-6"
    >
      <p className="text-slate-900">
        You already have an account for {email}. Enter its password to join{" "}
        {organisationName}.
      </p>

      <PasswordField
        label="Password"
        hint="Already logged in as this email? Leave it blank."
        name="currentPassword"
        autoComplete="current-password"
        disabled={result?.ok}
      />

      {/* The error itself is toasted, like every other mutation's. */}
      {result && !result.ok && result.accountExists && (
        <Link href="/login" className="text-primary underline">
          Or log in, then return to this link to finish joining.
        </Link>
      )}

      <button
        type="submit"
        disabled={isPending || result?.ok}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50 border-2 border-ink font-bold"
      >
        {isPending && <Spinner />}
        {isPending ? "Joining…" : `Join ${organisationName}`}
      </button>
    </form>
  );
}
