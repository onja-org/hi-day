"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import { parseInviteEmails } from "@/lib/parseInviteEmails";

type InviteEmailsFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function InviteEmailsField({ value, onChange }: InviteEmailsFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    file.text().then((content) => {
      onChange(parseInviteEmails(`${value}\n${content}`).join("\n"));
    });

    event.target.value = "";
  }

  return (
    <>
      <label className="flex flex-col gap-1.5">
        Emails
        <textarea
          name="emails"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          rows={5}
          placeholder="jane@acme.com, joe@acme.com&#10;or one per line"
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <span className="text-sm text-slate-900">
          Paste one or more emails, separated by commas or new lines.
        </span>
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={handleCsvUpload}
        className="hidden"
      />
    </>
  );
}
