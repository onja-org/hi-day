# Paying ends the trial that day

## The ask

An Organisation that pays should start its paid subscription immediately,
anchored to the payment date, and stop being treated as on a trial.

## What this reverses

An earlier version of the payment modal did the opposite, and deliberately:
it passed `trial_end` to Stripe so that somebody adding a card on day six of
fourteen kept the other eight days and was first charged when the trial
would have run out. The reasoning was that the product had promised
fourteen days and charging sooner takes days back.

That is the better deal for the customer and the worse product. It left
every Organisation that had paid still carrying a live trial — a countdown
banner on every page, "your trial ends in 3 days" emails to the owner, a
trial card on the Billing page — all of it true of the record and false of
the situation. The fix for that is not to suppress each surface in turn; it
is for paying to end the trial.

## What this ADR decided

- **The first successful payment ends the trial, that day.** `Subscription.
  status` goes `trialing` → `active` and `trialEndedAt` is stamped with the
  date. The paid period is anchored to the payment, not to `trialEndsAt`.
- **Remaining trial days are forfeited.** Not credited, not prorated, not
  extended. Paying on day six of fourteen gives up eight days. This is the
  cost of the decision and is stated plainly in the modal — *"You'll be
  charged today, and your trial ends when you pay"* — rather than being
  discovered on a statement.
- **Stripe is told nothing about a trial.** No `trial_end`, no
  `trial_period_days`, so Stripe raises a full invoice at checkout and the
  browser confirms a PaymentIntent. The SetupIntent branch the previous
  design needed is gone, along with the `mode` field that chose between
  them.
- **Only the webhook may end a trial.** The browser confirming a card can be
  closed, lose its network, or simply lie; a subscription paid in Stripe but
  `trialing` here would keep nagging somebody who has paid. `invoice.paid`
  (and `invoice.payment_succeeded`, the same event under another name) is
  the single writer.
- **Idempotent by construction, not by a ledger.** The handler writes only
  on the `trialing` → `active` transition. A retried webhook, the duplicate
  event pair, and every renewal invoice for years afterwards all find the
  row already `active` and do nothing — which is also what keeps
  `trialEndedAt` on the date of the *first* payment rather than the latest
  one. No processed-event table was needed to get this.
- **Our status and Stripe's stay separate.** `status` answers "has this
  Organisation ever paid"; `stripeStatus` mirrors Stripe's own word for
  whether the money is currently arriving. One column holding both is how a
  webhook about a failed renewal silently un-pays a customer and puts them
  back on a trial that ended months ago.
- **Trial history is kept and not read.** `trialStartedAt`, `trialEndsAt`
  and `trialEndedAt` stay on the row for audit. No behaviour consults them
  once `status` is `active`.
- **The seat rule is untouched.** Billed seats remain
  `max(purchasedSeats, active Memberships)` — see `docs/adr/0030-...` and
  CONTEXT.md's Billed seat entry.

## A failed or cancelled subscription later

It stays `active`. They are a paying customer whose payment is in trouble,
which is a different thing from a trialing one, and reverting them would
offer "Add payment" to somebody who has already paid. The Billing page reads
`stripeStatus` instead: anything other than `active` turns the summary card
amber, renames "Next payment" to "Period ends", and says what Stripe
reported. Access is governed by the grace period in
`docs/adr/0030-...`, unchanged.

## Not verified

No payment has been put through this flow. The trial-ending transition, its
idempotency and the seat arithmetic are covered by unit tests against mocks;
what is untested is Stripe actually sending `invoice.paid` for a first
charge and the row flipping in response. That needs `stripe listen` against
a running backend.
