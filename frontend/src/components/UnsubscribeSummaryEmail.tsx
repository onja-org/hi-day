"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { SUMMARY_EMAIL_LABELS } from "@/lib/summaryEmailLabels";
import { unsubscribeSummaryEmail } from "@/lib/unsubscribeSummaryEmail";
import { ErrorMessage } from "./ErrorMessage";

type UnsubscribeSummaryEmailProps = { token: string };

/**
 * A button rather than turning it off on page load: mail scanners open
 * links to check them, and must not switch anyone's email off by doing so.
 */
export function UnsubscribeSummaryEmail({ token }: UnsubscribeSummaryEmailProps) {
  const mutation = useMutation({
    mutationFn: () => unsubscribeSummaryEmail(token),
    meta: { inlineErrors: true },
  });
  const result = mutation.data;

  if (result?.ok) {
    return (
      <div className="flex flex-col gap-3 text-slate-900">
        <p>
          Done — you won&apos;t get the{" "}
          <strong>{SUMMARY_EMAIL_LABELS[result.kind].toLowerCase()}</strong>{" "}
          from {result.organisationName} any more.
        </p>
        <p className="text-sm text-slate-900/70">
          Changed your mind? You can switch it back on from{" "}
          <Link
            href="/account/edit"
            className="text-primary underline transition-colors duration-150 hover:text-primary-dark"
          >
            your account page
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-slate-900">
        Stop receiving this summary email? Your other summary emails are not
        affected.
      </p>
      {result && !result.ok && <ErrorMessage message={result.message} />}
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="h-11 cursor-pointer self-start rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? "Turning off…" : "Turn off this email"}
      </button>
    </div>
  );
}
