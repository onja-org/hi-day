import type { AcceptInvitationResult } from "@/types/invitation";
import { Spinner } from "./Spinner";

type JoinExistingAccountViewProps = {
  email: string;
  organisationName: string;
  result: AcceptInvitationResult | undefined;
  isPending: boolean;
  onJoin: () => void;
};

export function JoinExistingAccountView({
  email,
  organisationName,
  result,
  isPending,
  onJoin,
}: JoinExistingAccountViewProps) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <p className="text-slate-900">
        You already have an account for {email}. If you&apos;re logged in,
        join {organisationName} below.
      </p>
      <button
        type="button"
        onClick={onJoin}
        disabled={isPending || result?.ok}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50 border-2 border-ink font-bold"
      >
        {isPending && <Spinner />}
        {isPending ? "Joining…" : `Join ${organisationName}`}
      </button>
    </div>
  );
}
