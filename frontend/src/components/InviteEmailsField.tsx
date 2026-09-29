"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import { parseInviteEmails } from "@/lib/parseInviteEmails";
import { TextareaField } from "@/components/ui/form/TextareaField";

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
      <TextareaField
        label="Emails"
        name="emails"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        rows={5}
        placeholder="jane@acme.com, joe@acme.com&#10;or one per line"
        hint="Paste one or more emails, separated by commas or new lines."
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        aria-label="Upload CSV of emails"
        onChange={handleCsvUpload}
        className="hidden"
      />
    </>
  );
}
