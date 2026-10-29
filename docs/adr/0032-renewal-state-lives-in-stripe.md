# Renewal state lives in Stripe, not in our database

## The decision

A paying Organisation's renewal state — `status`, `cancel_at_period_end`,
the period end, the subscription item's quantity, the card on file, the next
amount — is read from Stripe on every request that needs it. None of it is
stored. Our `subscriptions` row keeps the ids needed to find the subscription
again, plus the trial history (`trialStartedAt`, `trialEndsAt`,
`trialEndedAt`) and our own one-way `status` of "has this ever paid".

Auto-renew is `cancel_at_period_end` on the Stripe subscription, not a column
here. The next payment amount is Stripe's own `invoices.createPreview`, not
our arithmetic.

## Why

A copy goes stale the moment anyone changes a card in Stripe's dashboard, and
the webhook that would refresh it is the thing that can be missed — which we
watched happen twice locally in one afternoon. A page that says "Visa ••••
4242, renews 29 Nov" from our own table, while Stripe holds a different card
and a different date, is worse than a page that is briefly slower.

It also removes a whole class of question. There is no "which is right, ours
or Stripe's", no reconciliation job for five fields, and no migration when
Stripe adds a status.

## What it costs, and what we accepted

**A Stripe round trip per billing page load**, sometimes two — the
subscription, and the upcoming-invoice preview. Accepted because the Billing
page is rare and billing being wrong is expensive. Mitigated only by not
asking for what nothing renders: an earlier version also fetched the latest
invoice for a field no component used, and that was deleted.

**The page depends on Stripe being reachable.** When it is not, the card is
replaced by "we can't reach your subscription right now; your access is
unaffected" rather than a blank page or an invented figure. Access itself
never depends on this read.

**Two numbers both called "seats".** `Organisation.purchasedSeats` is ours
and authoritative for a trial; the item `quantity` is Stripe's and is what
actually gets invoiced. They can differ — a dashboard edit, a failed sync —
and the Billing page shows Stripe's. CONTEXT.md names both.

## What is still stored, and why that is not a contradiction

- **`status` (`trialing` / `active`)** — our own answer to "has this ever
  paid", which is a different question from "is Stripe collecting right now"
  (`stripeStatus`, mirrored verbatim). One column holding both is how a
  webhook about a failed renewal silently un-pays a customer.
- **Trial history** — not renewal state, and Stripe never knew about our
  trial in the first place (`docs/adr/0031-...`).
- **`lastInvoiceEmailedId`** — about *our* side effects, not Stripe's state:
  it stops a retried webhook sending a second receipt.

## Not verified

No renewal has happened. Auto-renew, the cycle switch and the seat proration
are covered by unit tests against mocked Stripe calls; what is untested is
Stripe actually renewing a subscription and the page reflecting it. That
needs a billing period to elapse, or a clock-advanced test subscription.
