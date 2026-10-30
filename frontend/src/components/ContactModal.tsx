"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { sendContactMessage } from "@/lib/sendContactMessage";
import {
  MESSAGE_MAX_LENGTH,
  validateContactMessage,
  type ContactFieldErrors,
} from "@/lib/contactRules.generated";

type ContactModalProps = {
  onClose: () => void;
};

type Fields = {
  email: string;
  website: string;
  phone: string;
  message: string;
  /** The honeypot. Never shown, never filled by a person. */
  company: string;
};

const EMPTY: Fields = {
  email: "",
  website: "",
  phone: "",
  message: "",
  company: "",
};

/**
 * The public "Talk to us" form.
 *
 * Validation runs the **same code the server runs** — `contactRules.generated`
 * is a copy of the backend's module, so the form cannot accept something the
 * server will reject and leave somebody stuck with no explanation. The server
 * still checks everything again; this copy is a courtesy, not the gate.
 */
export function ContactModal({ onClose }: ContactModalProps) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  /** Only a field that has been left shows its error, so typing is quiet. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function set(name: keyof Fields, value: string): void {
    const next = { ...fields, [name]: value };
    setFields(next);
    // Re-checked as they type only once they have already seen the error,
    // so a message disappears the moment it stops being true.
    if (touched[name]) setErrors(validateContactMessage(next));
  }

  function blur(name: keyof Fields): void {
    setTouched((was) => ({ ...was, [name]: true }));
    setErrors(validateContactMessage(fields));
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const found = validateContactMessage(fields);
    setErrors(found);
    setTouched({ email: true, website: true, phone: true, message: true });
    if (Object.keys(found).length > 0) return;

    setSending(true);
    setFailed(false);
    const result = await sendContactMessage(fields);
    setSending(false);

    if (result.ok) {
      setSentTo(fields.email.trim());
      return;
    }
    // The input is left exactly as typed either way — re-entering a message
    // because a request failed is the worst part of a form like this.
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setFailed(true);
  }

  if (sentTo) {
    return (
      <Modal title="Talk to us" onClose={onClose}>
        <p className="text-sm text-slate-900">
          Thanks! Your message has been sent. We&apos;ll reply to you at{" "}
          <strong className="break-all">{sentTo}</strong>.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }

  const remaining = MESSAGE_MAX_LENGTH - fields.message.length;

  return (
    <Modal title="Talk to us" onClose={onClose}>
      <p className="-mt-4 text-sm text-slate-900/60">
        Have a question, idea, or feedback? Send us a message and we&apos;ll
        get back to you.
      </p>

      {failed && (
        <ErrorMessage message="Something went wrong. Please try again." />
      )}

      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <Field
          id="contact-email"
          label="Email address"
          error={touched.email ? errors.email : undefined}
        >
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={() => blur("email")}
            aria-invalid={Boolean(touched.email && errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            className={inputClass(Boolean(touched.email && errors.email))}
          />
        </Field>

        <Field
          id="contact-website"
          label="Website URL"
          error={touched.website ? errors.website : undefined}
        >
          <input
            id="contact-website"
            type="text"
            inputMode="url"
            placeholder="acme.com"
            autoComplete="url"
            value={fields.website}
            onChange={(e) => set("website", e.target.value)}
            onBlur={() => blur("website")}
            aria-invalid={Boolean(touched.website && errors.website)}
            aria-describedby={
              errors.website ? "contact-website-error" : undefined
            }
            className={inputClass(Boolean(touched.website && errors.website))}
          />
        </Field>

        <Field
          id="contact-phone"
          label="Phone number"
          optional
          error={touched.phone ? errors.phone : undefined}
        >
          <input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            value={fields.phone}
            onChange={(e) => set("phone", e.target.value)}
            onBlur={() => blur("phone")}
            aria-invalid={Boolean(touched.phone && errors.phone)}
            aria-describedby={errors.phone ? "contact-phone-error" : undefined}
            className={inputClass(Boolean(touched.phone && errors.phone))}
          />
        </Field>

        <Field
          id="contact-message"
          label="Message"
          error={touched.message ? errors.message : undefined}
          hint={
            <span
              className={remaining < 0 ? "font-bold text-error" : undefined}
              aria-live="polite"
            >
              {remaining} characters left
            </span>
          }
        >
          <textarea
            id="contact-message"
            rows={5}
            value={fields.message}
            onChange={(e) => set("message", e.target.value)}
            onBlur={() => blur("message")}
            aria-invalid={Boolean(touched.message && errors.message)}
            aria-describedby={
              errors.message ? "contact-message-error" : undefined
            }
            className={inputClass(Boolean(touched.message && errors.message))}
          />
        </Field>

        {/* The honeypot: off-screen rather than `display: none`, which some
            bots skip, and hidden from assistive tech so nobody is ever asked
            to fill it. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 overflow-hidden">
          <label htmlFor="contact-company">Company (leave this empty)</label>
          <input
            id="contact-company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={fields.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t-2 border-ink/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-5 text-sm font-bold text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-brand-sm border-2 border-ink bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending && <Spinner className="text-white" />}
            {sending ? "Sending…" : "Send message"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function inputClass(invalid: boolean): string {
  return [
    "w-full rounded-brand-sm border-2 bg-white px-3 py-2.5 text-sm text-ink",
    "placeholder:text-slate-900/40 focus:outline-none",
    invalid ? "border-error" : "border-ink focus:border-primary",
  ].join(" ");
}

function Field({
  id,
  label,
  optional = false,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-slate-900">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-slate-900/60">(optional)</span>
        )}
      </label>
      {children}
      {/* The error replaces the hint rather than stacking under it: two lines
          of small print below one input is where people stop reading. */}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-error">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-slate-900/60">{hint}</p>
      )}
    </div>
  );
}
