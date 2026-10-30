# Grace runs from the period end, not from Stripe's retries

## The ask

Seven days of continued access after a trial or a paid plan ends, before
the organisation loses it.

## The problem

A trial has one unambiguous end: `trialEndsAt`, a date we set. A paid
subscription has three, and Stripe
([docs](https://docs.stripe.com/billing/subscriptions/overview)) keeps them
distinct:

- the customer **cancels**, and access runs to `current_period_end` — a
  departure they chose, on a date they picked;
- a renewal **fails**, and the subscription goes `past_due`, where Smart
  Retries keep attempting payment for a window configured in the Stripe
  Dashboard;
- retries run out, and it becomes `unpaid` or `canceled`.

Stripe's own guidance is explicit about the last of these: *"Revoke access
to your product when the subscription is `unpaid` because Stripe already
attempted and retried payment while the subscription was `past_due`."*

So "seven days after the subscription ends" has three possible anchors, and
they are weeks apart.

## What this ADR decided

**Grace is measured from the end of the period that was paid for** —
`trialEndsAt` for a trial, `currentPeriodEnd` for a subscription — and from
nothing else. One function, `accessEndsAfter`, takes either and adds
`GRACE_DAYS`.

The alternative was to follow Stripe literally and start the seven days when
the subscription reaches `unpaid`. We did not, for one reason: **the retry
schedule lives in the Stripe Dashboard, not in this repository.** Anchoring
to it would make total access-after-payment a number nobody can read off the
code, changeable by someone editing a Stripe setting, and different between
test and production. A date derived from `currentPeriodEnd` is the same
arithmetic as the trial's, is visible in one constant, and is a date the
banner can name — which is the whole point of a grace period somebody is
meant to plan around.

The cost is accepted and worth stating plainly: **for a failed renewal the
seven days are not additive.** Stripe carries on collecting past
`currentPeriodEnd`, so the grace window overlaps the retry window rather
than extending it, and a customer whose card fails may keep access well
beyond seven days — until Stripe gives up. Where the decision actually bites
is a cancellation running out and a renewal that never came, which are the
cases with no Stripe retry behind them at all.

We also chose not to fold any of this into `SubscriptionStatus`. Expiry and
grace stay **derived** from dates, as trial expiry already was: a stored
flag makes correctness depend on a job having run, so a day's outage would
show an admin "in grace" on an organisation whose access had gone.

## Not decided here

**What "blocked" means.** Nothing is enforced at the end of grace today —
the banner names a date and the product keeps working past it. That is a
separate decision (read-only? refuse new timers? full 403?) and until it
lands, this ADR widens a promise rather than a restriction. The banner copy
was deliberately left naming the date, since it describes the intended
behaviour.
