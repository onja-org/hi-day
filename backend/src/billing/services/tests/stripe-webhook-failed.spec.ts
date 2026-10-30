import type Stripe from 'stripe';
import { StripeWebhookService } from '../stripe-webhook.service';
import { ORGANISATION_METADATA_KEY } from '../checkout.service';

function serviceFor(
  row: Record<string, unknown> | null,
  /** What the PaymentIntent behind the invoice says went wrong. */
  lastPaymentError: Record<string, unknown> | null = {
    message: 'Your card has insufficient funds.',
    decline_code: 'insufficient_funds',
  },
) {
  const sendSeatChargeFailedEmail = jest.fn().mockResolvedValue(undefined);
  const list = jest.fn().mockResolvedValue({
    data: [{ payment: { payment_intent: { last_payment_error: lastPaymentError } } }],
  });
  const service = new StripeWebhookService(
    { findOne: jest.fn().mockResolvedValue(row), update: jest.fn() } as never,
    {
      findOne: jest.fn().mockResolvedValue({
        id: 'org-1',
        name: 'Acme Inc',
        billingEmail: 'ap@acme.test',
        owner: { email: 'owner@acme.test' },
      }),
    } as never,
    {
      isConfigured: true,
      stripe: { invoicePayments: { list } },
    } as never,
    { sendSeatChargeFailedEmail } as never,
    { get: () => 'whsec_test' } as never,
  );
  return { service, sendSeatChargeFailedEmail, list };
}

function failedInvoice(organisationId: string | undefined = 'org-1'): Stripe.Event {
  return {
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_9',
        amount_due: 800,
        currency: 'usd',
        hosted_invoice_url: 'https://stripe.test/in_9',
        parent: {
          subscription_details: {
            subscription: 'sub_1',
            metadata: organisationId
              ? { [ORGANISATION_METADATA_KEY]: organisationId }
              : {},
          },
        },
      },
    },
  } as unknown as Stripe.Event;
}

describe('a declined seat charge', () => {
  it('warns the owner and the billing address, with the reason the issuer gave', async () => {
    const { service, sendSeatChargeFailedEmail } = serviceFor({
      id: 'sub-row-1',
      organisationId: 'org-1',
    });

    await service.handle(failedInvoice());

    expect(sendSeatChargeFailedEmail).toHaveBeenCalledWith(
      // Both, unlike a receipt: the seats are already in use, so an
      // unverified billing address must not be the only copy.
      ['owner@acme.test', 'ap@acme.test'],
      'Acme Inc',
      '$8',
      'Your card has insufficient funds.',
      'https://stripe.test/in_9',
    );
  });

  it('still warns when Stripe gives no reason at all', async () => {
    const { service, sendSeatChargeFailedEmail } = serviceFor(
      { id: 'sub-row-1', organisationId: 'org-1' },
      null,
    );

    await service.handle(failedInvoice());

    expect(sendSeatChargeFailedEmail).toHaveBeenCalledWith(
      expect.anything(),
      'Acme Inc',
      '$8',
      'The payment was declined by the card issuer.',
      expect.anything(),
    );
  });

  // `stripe trigger` fabricates exactly this, and a failed invoice carries no
  // money to lose track of — so it is accepted rather than retried for days.
  it('accepts an invoice it cannot place instead of asking Stripe to retry', async () => {
    const { service, sendSeatChargeFailedEmail } = serviceFor(null);

    await expect(service.handle(failedInvoice(undefined))).resolves.toBeUndefined();
    expect(sendSeatChargeFailedEmail).not.toHaveBeenCalled();
  });

  // The membership stays. A card failing is a billing problem, not grounds to
  // throw somebody out of an organisation they were invited to.
  it('never fails the event when the warning email cannot be sent', async () => {
    const { service, sendSeatChargeFailedEmail } = serviceFor({
      id: 'sub-row-1',
      organisationId: 'org-1',
    });
    sendSeatChargeFailedEmail.mockRejectedValue(new Error('Resend is down'));

    await expect(service.handle(failedInvoice())).resolves.toBeUndefined();
  });
});
