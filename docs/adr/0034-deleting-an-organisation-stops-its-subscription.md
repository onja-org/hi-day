---
status: accepted
---

# Deleting an Organisation stops its subscription

ADR-0021 left billing out of deletion because no billing existed yet, and said cancellation would belong in `suspend()` once it did. Billing then landed without it. Suspension and purge never called Stripe, so a deleted Organisation kept renewing: the customer was charged after deleting their account, and once the purge erased our `subscriptions` row we no longer had the ids to stop it. Its admins couldn't stop it either, because `RoleGuard` refuses every Billing route while an Organisation is suspended.

`SubscriptionCancellationService` (billing) now does this, called by the deletion services.

## Decisions

- **Suspension stops renewal; it doesn't cancel.** It sets `cancel_at_period_end` on the Stripe subscription. The 30-day recovery window means a suspension can be undone, and an outright cancel can't: a restored Organisation would have to subscribe again. The period already paid for runs out as normal, and nothing is refunded.
- **Restore turns renewal back on only if deletion turned it off.** Stopping renewal also writes `renewalStoppedByDeletion: "true"` to the subscription's Stripe metadata. A restore clears it and sets `cancel_at_period_end` back to false only when the mark is there, so a customer who had already turned auto-renew off keeps it off. The mark lives in Stripe beside the state it describes, not in a column of ours (ADR-0032). A subscription whose period ended during the suspension is not revived; the owner subscribes again from the Billing page.
- **Restore checks billing first.** If Stripe can't be reached, the restore is refused and nothing changes; the owner retries. The alternative, a restored Organisation still set to end at the period end, would cut them off again weeks later with nothing to say why.
- **A suspension never fails because of Stripe.** The owner asked for it and it has already committed. Stopping renewal runs after the transaction, and a failure is logged. The hourly deletion job re-applies it to every suspended Organisation that isn't yet purging. It's idempotent, so this costs one Stripe read per suspended Organisation per hour, and an outage at suspension time is caught within the hour.
- **The purge cancels outright, before erasing anything.** Our row is the only record of the subscription id, so `purge()` cancels first. If Stripe can't be reached it throws before any data or objects are touched, and the hourly job retries the whole purge. `subscriptions` is then deleted explicitly alongside the other tables rather than left to the `ON DELETE CASCADE`. The cancel uses Stripe's defaults: no proration credit and no final invoice.
- **Webhooks for a deleted Organisation are answered 200.** An event naming an Organisation that doesn't exist can't be a race (the Organisation always exists long before any checkout), so no retry can place it. The usual one is our own purge's `customer.subscription.deleted`, which lands after the row is gone. Answering 503 had Stripe retrying each such event for three days, and risked it disabling the endpoint for every customer. A *paid* invoice for a deleted Organisation is logged as an error, because someone should check whether it needs refunding.
- **Billing off: nothing changes.** Self-hosted installs never construct `BillingModule`, so the deletion services take the cancellation service as `@Optional()` and skip it.

## Not handled

- **Unpaid balances.** An open invoice at suspension is left to Stripe's dunning as before, and the purge doesn't settle or void it.
- **A purge that can never cancel.** If Stripe keeps refusing (say, the API key is revoked), the purge keeps failing and logging hourly, and the Organisation stays suspended past its `purgeAt`. That is the intended trade: erasing the ids would leave a live subscription nobody can find.
