"use client";

import { useState } from "react";
import { ContactModal } from "../ContactModal";

/**
 * Shown on `/pricing` and again inside Settings → Billing: the same message
 * belongs in both places, and the Billing page is where an admin is already
 * thinking about the bill. Deliberately one component rather than two —
 * "same price per person" is a claim that must not drift between pages.
 *
 * "Talk to us" opens the contact form rather than a `mailto:` link, which it
 * used to be. A mail client link assumes one is configured, loses the
 * message if it is not, and tells us nothing about who was asking.
 */
export function PricingLargeTeam() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex max-w-245 flex-wrap items-center justify-between gap-4 rounded-brand border-3 border-ink bg-white px-7 py-6 shadow-hard-sm">
      <div className="flex max-w-105 flex-col gap-1">
        <h2 className="font-display text-2xl font-extrabold tracking-heading">More than 50 people?</h2>
        <p className="text-ink-muted">
          Same features, same price per person. Get in touch and we&apos;ll help you get set up.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 cursor-pointer items-center justify-center rounded-brand-sm border-3 border-ink bg-white px-5 font-extrabold text-ink shadow-hard-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt"
      >
        Talk to us
      </button>

      {/* Unmounted when closed, so the Modal's focus handling returns focus
          to the button above on every close. */}
      {open && <ContactModal onClose={() => setOpen(false)} />}
    </div>
  );
}
