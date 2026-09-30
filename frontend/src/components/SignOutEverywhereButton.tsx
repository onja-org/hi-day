"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutEverywhere } from "@/lib/logoutEverywhere";
import { ConfirmDialog } from "./ConfirmDialog";

export function SignOutEverywhereButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleConfirm() {
    setSigningOut(true);
    await logoutEverywhere();
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-input-border p-4">
      <h2 className="font-medium text-primary-dark">Sign out everywhere</h2>
      <p className="text-sm text-slate-900/70">
        Ends this session and every device you&apos;ve paired the desktop app
        on — use this if a device is lost, or you just want a clean slate.
        Signing out normally only ends this browser session.
      </p>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer self-start rounded-md border border-primary-dark/20 px-4 h-11 text-sm font-medium text-primary-dark transition-colors duration-150 hover:bg-cream"
      >
        Sign out everywhere
      </button>

      {confirming && (
        <ConfirmDialog
          title="Sign out everywhere"
          message="This signs you out of this browser and every paired desktop device, and stops any timer those devices have running. You'll need to log in and re-pair any desktop app afterward."
          confirmLabel="Sign out everywhere"
          isDangerous
          isPending={signingOut}
          onConfirm={handleConfirm}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
