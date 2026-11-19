"use client";

import { useEffect } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { disableTwoFactor, renewRecoveryCodes } from "@/lib/twoFactorApi";
import type { ApiResult } from "@/types/api";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { RecoveryCodesList } from "./RecoveryCodesList";
import { Spinner } from "./Spinner";
import { TextField } from "./ui/form/TextField";

type TwoFactorCodeModalProps = {
  action: "disable" | "renew";
  email: string;
  /** Called on close; `changed` once the action went through. */
  onClose: (changed: boolean) => void;
};

/** Turning it off, or making new recovery codes, asks for a current code first. */
export function TwoFactorCodeModal({ action, email, onClose }: TwoFactorCodeModalProps) {
  const disable = action === "disable";
  const mutation = useMutation({
    mutationFn: (code: string): Promise<ApiResult<{ recoveryCodes?: string[] }>> =>
      disable ? disableTwoFactor(code) : renewRecoveryCodes(code),
    meta: { inlineErrors: true },
  });
  const result = mutation.data;
  const recoveryCodes = (result?.ok && result.recoveryCodes) || null;

  // Turning off has nothing left to show; the toast confirms it.
  useEffect(() => {
    if (result?.ok && !recoveryCodes) onClose(true);
  }, [result, recoveryCodes, onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(String(new FormData(event.currentTarget).get("code") ?? ""));
  }

  if (recoveryCodes) {
    return (
      <Modal title="New recovery codes" onClose={() => onClose(true)}>
        <RecoveryCodesList codes={recoveryCodes} email={email} />
        <button
          type="button"
          onClick={() => onClose(true)}
          className="h-11 cursor-pointer self-end rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white hover:bg-primary/90"
        >
          I&apos;ve saved my codes
        </button>
      </Modal>
    );
  }

  return (
    <Modal title={disable ? "Turn off two-step login" : "Create new recovery codes"} onClose={() => onClose(false)}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-slate-900">
          {disable
            ? "Enter a code from your authenticator app, or a recovery code, to turn two-step login off. This signs you out of your other browsers."
            : "Enter a code from your authenticator app, or a recovery code. Your old recovery codes will stop working."}
        </p>
        {result && !result.ok && <ErrorMessage message={result.message} />}
        <TextField label="Code" name="code" autoComplete="one-time-code" maxLength={32} required autoFocus />
        <button
          type="submit"
          disabled={mutation.isPending}
          className={clsx(
            "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-brand-sm border-2 border-ink px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-70",
            disable && "bg-error hover:bg-error/90",
            !disable && "bg-primary hover:bg-primary/90",
          )}
        >
          {mutation.isPending && <Spinner />}
          {disable ? "Turn off" : "Create new codes"}
        </button>
      </form>
    </Modal>
  );
}
