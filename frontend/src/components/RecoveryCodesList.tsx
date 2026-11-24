"use client";

import { useState } from "react";
import { Copy, DownloadSimple } from "@phosphor-icons/react";
import { recoveryCodesFile } from "@/lib/recoveryCodesFile";

type RecoveryCodesListProps = {
  codes: string[];
  email: string;
};

/** Shown once, straight after the codes are made; they can't be shown again. */
export function RecoveryCodesList({ codes, email }: RecoveryCodesListProps) {
  const [copied, setCopied] = useState(false);
  const text = recoveryCodesFile(codes, email);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "hi-day-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-900">
        Save these recovery codes somewhere safe, like a password manager. If you lose your phone, each
        code lets you log in once. <strong>You won&apos;t be able to see them again.</strong>
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-brand-sm border-2 border-ink bg-cream p-4 font-data text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={copy}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-brand-sm border-2 border-ink px-4 text-sm font-semibold text-slate-900 hover:bg-cream"
        >
          <Copy size={18} aria-hidden="true" />
          {copied ? "Copied" : "Copy codes"}
        </button>
        <button
          type="button"
          onClick={download}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-brand-sm border-2 border-ink px-4 text-sm font-semibold text-slate-900 hover:bg-cream"
        >
          <DownloadSimple size={18} aria-hidden="true" />
          Download
        </button>
      </div>
    </div>
  );
}
