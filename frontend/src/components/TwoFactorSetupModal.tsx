"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { enableTwoFactor, startTwoFactorSetup } from "@/lib/twoFactorApi";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { RecoveryCodesList } from "./RecoveryCodesList";
import { Spinner } from "./Spinner";
import { TextField } from "./ui/form/TextField";

type TwoFactorSetupModalProps = {
  email: string;
  /** Called on close; `changed` once it has been turned on. */
  onClose: (changed: boolean) => void;
};

/** Scan the QR code, confirm a code, then save the recovery codes. */
export function TwoFactorSetupModal({ email, onClose }: TwoFactorSetupModalProps) {
  const [showSecret, setShowSecret] = useState(false);
  const setup = useMutation({ mutationFn: startTwoFactorSetup, meta: { silent: true } });
  const enable = useMutation({ mutationFn: enableTwoFactor, meta: { inlineErrors: true } });
  const { mutate: begin } = setup;

  useEffect(() => {
    begin();
  }, [begin]);

  const recoveryCodes = enable.data?.ok ? enable.data.recoveryCodes : null;
  const secret = setup.data?.ok ? setup.data.setup : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    enable.mutate(String(new FormData(event.currentTarget).get("code") ?? ""));
  }

  if (recoveryCodes) {
    return (
      <Modal title="Two-step login is on" onClose={() => onClose(true)}>
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
    <Modal title="Turn on two-step login" onClose={() => onClose(false)}>
      {setup.isPending && <Spinner />}
      {setup.data && !setup.data.ok && <ErrorMessage message={setup.data.message} />}
      {setup.isError && <ErrorMessage message="Something went wrong. Please try again." />}

      {secret && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-slate-900">
            1. Scan this QR code with an authenticator app such as Google Authenticator or 1Password.
          </p>
          <div className="self-center rounded-brand-sm border-2 border-ink bg-white p-3">
            <QRCodeSVG value={secret.otpauthUrl} size={176} title="QR code for your authenticator app" />
          </div>
          {showSecret ? (
            <p className="text-sm text-slate-900">
              Or enter this key in the app: <code className="break-all font-data">{secret.secret}</code>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setShowSecret(true)}
              className="cursor-pointer self-start text-sm text-primary underline-offset-2 hover:underline"
            >
              Can&apos;t scan it? Enter a key instead
            </button>
          )}

          <p className="text-sm text-slate-900">2. Enter the 6-digit code the app shows.</p>
          {enable.data && !enable.data.ok && <ErrorMessage message={enable.data.message} />}
          <TextField
            label="6-digit code"
            name="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={7}
            required
          />
          <button
            type="submit"
            disabled={enable.isPending}
            className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {enable.isPending && <Spinner />}
            Turn on
          </button>
          <p className="text-xs text-slate-900/60">
            Turning it on signs you out of your other browsers. Your desktop app stays signed in.
          </p>
        </form>
      )}
    </Modal>
  );
}
