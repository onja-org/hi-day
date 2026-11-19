"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TWO_FACTOR_STATUS_QUERY_KEY, useTwoFactorStatus } from "@/hooks/useTwoFactorStatus";
import { useMyProfile } from "@/hooks/useMyProfile";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { TwoFactorCodeModal } from "./TwoFactorCodeModal";
import { TwoFactorSetupModal } from "./TwoFactorSetupModal";

type OpenModal = "setup" | "disable" | "renew" | null;

/** The account page's two-step login card: turn it on or off, renew recovery codes. */
export function TwoFactorSection() {
  const status = useTwoFactorStatus();
  const profile = useMyProfile();
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const email = profile.data?.email ?? "";

  const close = useCallback(
    (changed: boolean) => {
      setOpenModal(null);
      if (changed) queryClient.invalidateQueries({ queryKey: TWO_FACTOR_STATUS_QUERY_KEY });
    },
    [queryClient],
  );

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-input-border p-4">
      <h2 className="font-medium text-primary-dark">Two-step login</h2>
      <p className="text-sm text-slate-900/70">
        After your password, also ask for a code from an authenticator app on your phone, such as
        Google Authenticator or 1Password. Someone who learns your password still can&apos;t get in.
      </p>

      {status.isPending && <Spinner />}
      {status.isError && <ErrorMessage message="Couldn't load your two-step login settings." />}

      {status.data && !status.data.enabled && (
        <button
          type="button"
          onClick={() => setOpenModal("setup")}
          className="h-11 cursor-pointer self-start rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90"
        >
          Turn on two-step login
        </button>
      )}

      {status.data?.enabled && (
        <>
          <p className="text-sm text-slate-900">
            <strong>On.</strong> You have {status.data.recoveryCodesRemaining} unused recovery{" "}
            {status.data.recoveryCodesRemaining === 1 ? "code" : "codes"} left.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setOpenModal("renew")}
              className="h-11 cursor-pointer rounded-brand-sm border-2 border-ink px-4 text-sm font-semibold text-slate-900 hover:bg-cream"
            >
              Create new recovery codes
            </button>
            <button
              type="button"
              onClick={() => setOpenModal("disable")}
              className="h-11 cursor-pointer rounded-brand-sm border-2 border-ink px-4 text-sm font-semibold text-slate-900 hover:bg-cream"
            >
              Turn off
            </button>
          </div>
        </>
      )}

      {openModal === "setup" && <TwoFactorSetupModal email={email} onClose={close} />}
      {(openModal === "disable" || openModal === "renew") && (
        <TwoFactorCodeModal action={openModal} email={email} onClose={close} />
      )}
    </section>
  );
}
