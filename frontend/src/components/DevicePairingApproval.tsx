"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { approveDevicePairing } from "@/lib/approveDevicePairing";
import { devicePlatformLabel } from "@/lib/devicePlatformLabel";
import { getDevicePairing } from "@/lib/getDevicePairing";
import { ErrorMessage } from "./ErrorMessage";
import { OpenDesktopAppButton } from "./OpenDesktopAppButton";
import { Spinner } from "./Spinner";
import { SuccessMessage } from "./SuccessMessage";

type DevicePairingApprovalProps = {
  code: string;
};

export function DevicePairingApproval({ code }: DevicePairingApprovalProps) {
  const pairingQuery = useQuery({
    queryKey: ["device-pairing", code],
    queryFn: async () => {
      const result = await getDevicePairing(code);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.summary;
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveDevicePairing(code),
  });

  if (pairingQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Checking this link…
      </p>
    );
  }

  if (pairingQuery.isError || !pairingQuery.data) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <ErrorMessage
          message={
            pairingQuery.error instanceof Error
              ? pairingQuery.error.message
              : "This link is invalid or has expired."
          }
        />
        <p className="text-slate-900">
          Open Hi Day and start again from there for a fresh link.
        </p>
        <OpenDesktopAppButton />
      </div>
    );
  }

  if (approveMutation.data?.ok) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <SuccessMessage message="You're logged in — you can go back to the desktop app now." />
        <OpenDesktopAppButton />
        <Link
          href="/dashboard"
          className="flex h-11 items-center justify-center gap-2 rounded-brand-sm border-2 border-ink px-4 font-semibold text-slate-900 transition-colors duration-150 hover:bg-cream"
        >
          Open the web app
        </Link>
      </div>
    );
  }

  const summary = pairingQuery.data;

  // A refusal (e.g. the organisation was deleted) replaces the login prompt
  // so the person isn't invited to retry something that can't work.
  if (approveMutation.data && !approveMutation.data.ok) {
    return <ErrorMessage message={approveMutation.data.message} />;
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <p className="text-slate-900">
        Log in on <strong>{devicePlatformLabel(summary.platform)}</strong>
        {summary.hostname ? ` (${summary.hostname})` : ""}?
      </p>

      <button
        type="button"
        onClick={() => approveMutation.mutate()}
        disabled={approveMutation.isPending}
        className="flex items-center justify-center gap-2 cursor-pointer rounded-brand-sm border-2 border-ink px-4 h-11 text-white transition-all duration-150 bg-primary/90 hover:scale-105 hover:bg-primary active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100 font-bold"
      >
        {approveMutation.isPending && <Spinner />}
        {approveMutation.isPending ? "Logging in…" : "Log in"}
      </button>
    </div>
  );
}
