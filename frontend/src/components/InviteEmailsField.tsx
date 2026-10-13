"use client";

import { TextareaField } from "@/components/ui/form/TextareaField";

type InviteEmailsFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function InviteEmailsField({ value, onChange }: InviteEmailsFieldProps) {
  return (
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
  );
}
