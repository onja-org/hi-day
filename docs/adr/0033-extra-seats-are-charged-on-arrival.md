# Extra seats are charged on arrival, not at the next renewal

## The decision

When somebody joins an Organisation that has used up every seat it bought,
the part-period cost of that seat is invoiced and charged to the card on
file **immediately**, as they accept. `pushQuantity` sends Stripe
`proration_behavior: 'always_invoice'` whenever the seat count goes up.

Consent for that is taken in the invite forms, not on the page. While
`seatsAreFull` is true, every form that can bring somebody in — "Invite
people", "Create invite link" and "Import members" — shows a notice and
holds its submit button disabled until an admin ticks "I understand my bill
will change."

All three reach the same `inviteMembers` endpoint, so all three gate on it.
Import names the number of people in the submission, because a file of forty
is a different commitment from one invitation and identical wording would
understate it; picking a different file clears the tick, while resuming a
send that failed partway keeps it.

A charge that fails changes nothing. The people who joined keep working;
`invoice.payment_failed` emails the owner and the billing address with the
reason the issuer gave, and Stripe's Smart Retries own the recovery.

A seat count going **down** is unchanged: a monthly drop lands whole on the
next invoice, an annual one leaves a credit against it.

## Why

This was asked for directly, after the case against it was put and
considered. The reasoning recorded here is the counter-case, because it is
the part a future reader will not have:

Stripe's own default is the opposite. Its prorations guide says positive
prorations "aren't immediately billed", and `always_invoice` exists for
admin-initiated plan changes rather than per-member events. Slack, Linear
and Notion all defer to the next invoice. So the shape here is deliberately
unusual, and the three costs are known and accepted:

- **Transaction fees.** At $4.00 a seat a month, a seat added mid-month is a
  ~$2.00 charge. Stripe's 2.9% + $0.30 takes ~18% of it, and more the later
  in the period it lands. Batching the same seats onto one invoice would pay
  that 30c once.
- **Bulk onboarding.** Inviting eight people produces eight charges, eight
  invoices and eight webhook rounds for what is, to the customer, one act.
- **A decline is now on the critical path of hiring.** A $2.00 charge that
  fails puts the subscription at risk of `past_due` — the whole account, over
  two dollars.

What is bought for that is simple and real: the money for a seat arrives
when the seat does, there is no window in which a team can grow and get a
month of service free, and an admin sees the consequence at the moment they
cause it rather than on a statement weeks later.

## What it costs, and what we accepted

**The consent is per-submission, not stored.** Ticking the box authorises
that invitation, nothing more; the next one asks again. The Members page
banner and the `seatsOverageAcknowledgedAtMembers` column it ran on were
deleted rather than left unread: a stored acknowledgement is exactly the
blanket consent an immediate charge must not run on.

**Managers are not asked.** The seat figures come from an admin-only
endpoint, so for a manager the query never resolves and the consent never
appears. Refusing to let a manager invite anybody because of a request they
are not permitted to make would break the page; the seat is charged either
way.

**A reason costs an extra API call.** Stripe moved the PaymentIntent off the
Invoice onto its `payments`, and a webhook body expands neither, so the
decline reason is simply not in the event. `declineReasonFor` fetches it and
falls back to a generic line rather than failing — an email naming no reason
still beats no email.

**Editing an invite link is not gated.** Renaming, capping or switching off a
link adds no seat, and needing to consent to a charge before you can *close*
a link would be backwards. Only creation is held.

**The gate is the interface, not the endpoint.** Nothing server-side checks
that consent was given, so an admin driving the API directly bypasses it.
Accepted because the consent exists to inform a human before they act, and
the endpoint is admin-only — whoever bypasses it is the person it would be
protecting. If consent ever needs to be an auditable record rather than an
interface courtesy, it belongs on the endpoint for all three forms at once,
not just whichever one is in hand.

## What would change our mind

Either of the first two costs showing up in the numbers — fees as a visible
share of seat revenue, or a support complaint about a wall of invoices from
one onboarding. The fix then is not to go back to deferring, but
`items.billing_thresholds.amount_gte`: Stripe invoices early once accrued
charges cross an amount, which bills promptly without billing per person.
