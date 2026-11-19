"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { navigateAfterSessionChange } from "@/lib/navigateAfterSessionChange";
import { verifyTwoFactorLogin } from "@/lib/verifyTwoFactorLogin";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { TextField } from "@/components/ui/form/TextField";

type TwoFactorLoginStepProps = {
  next: string;
  /** Back to the password step — asked for, or because the code step can't
   * go on (it timed out, or too many wrong codes now need a captcha). */
  onRestart: (notice: string | null, captchaRequired: boolean) => void;
};

export function TwoFactorLoginStep({ next, onRestart }: TwoFactorLoginStepProps) {
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const mutation = useMutation({
    mutationFn: verifyTwoFactorLogin,
    meta: { inlineErrors: true },
  });
  const failure = mutation.data && !mutation.data.ok ? mutation.data : null;

  useEffect(() => {
    if (mutation.data?.ok) navigateAfterSessionChange(next);
  }, [mutation.data, next]);

  useEffect(() => {
    if (failure?.restart) onRestart(failure.message, failure.captchaRequired === true);
  }, [failure, onRestart]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    mutation.mutate(code);
  }

  const done = mutation.isPending || mutation.data?.ok;

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-4xl flex-col gap-6 md:px-20 lg:px-0">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-semibold text-primary-dark">Two-step login</h3>
        <p className="text-slate-900">
          {useRecoveryCode
            ? "Enter one of the recovery codes you saved when you turned on two-step login. Each code works once."
            : "Open your authenticator app and enter the 6-digit code for Hi Day."}
        </p>
      </div>

      {failure && !failure.restart && <ErrorMessage message={failure.message} />}

      <TextField
        key={useRecoveryCode ? "recovery" : "app"}
        label={useRecoveryCode ? "Recovery code" : "6-digit code"}
        name="code"
        autoComplete="one-time-code"
        inputMode={useRecoveryCode ? "text" : "numeric"}
        placeholder={useRecoveryCode ? "XXXXX-XXXXX" : "123456"}
        maxLength={useRecoveryCode ? 32 : 7}
        required
        autoFocus
        disabled={mutation.data?.ok}
      />

      <button
        type="button"
        onClick={() => {
          mutation.reset();
          setUseRecoveryCode((value) => !value);
        }}
        className="cursor-pointer self-start text-sm text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-dark hover:underline"
      >
        {useRecoveryCode ? "Use a code from my app instead" : "Lost your phone? Use a recovery code"}
      </button>

      <button
        type="submit"
        disabled={done}
        className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {mutation.isPending && <Spinner />}
        {mutation.isPending ? "Checking…" : "Log in"}
      </button>

      <button
        type="button"
        onClick={() => onRestart(null, false)}
        className="cursor-pointer self-start text-sm text-slate-900 underline-offset-2 hover:underline"
      >
        Back to email and password
      </button>
    </form>
  );
}
