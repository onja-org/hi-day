import type Stripe from 'stripe';
import { StripeWebhookService } from '../stripe-webhook.service';
import { SubscriptionStatus } from '../../../database/entities/subscription-status.enum';
import { ORGANISATION_METADATA_KEY } from '../checkout.service';

function serviceFor(row: Record<string, unknown> | null) {
  const update = jest.fn();
  const sendInvoiceEmail = jest.fn().mockResolvedValue(undefined);
  const service = new StripeWebhookService(
    { findOne: jest.fn().mockResolvedValue(row), update } as never,
    {
      findOne: jest.fn().mockResolvedValue({
        id: 'org-1',
        publicId: 100001,
        name: 'Acme Inc',
        billingEmail: 'ap@acme.test',
        owner: { email: 'owner@acme.test' },
      }),
    } as never,
    { isFree: () => false, isConfigured: true } as never,
    { sendInvoiceEmail } as never,
    { get: () => 'whsec_test' } as never,
  );
  return { service, update, sendInvoiceEmail };
}

function paidInvoice(organisationId = 'org-1'): Stripe.Event {
  return {
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_1',
        amount_paid: 4200,
        amount_due: 4200,
        currency: 'usd',
        number: 'ACME-0001',
        hosted_invoice_url: 'https://stripe.test/in_1',
        parent: {
          subscription_details: {
            subscription: 'sub_1',
            metadata: { [ORGANISATION_METADATA_KEY]: organisationId },
          },
        },
      },
    },
  } as unknown as Stripe.Event;
}

describe('a payment ending the trial', () => {
  it('turns a trialing organisation active and stamps the day it happened', async () => {
    const { service, update } = serviceFor({
      id: 'sub-row-1',
      organisationId: 'org-1',
      status: SubscriptionStatus.TRIALING,
    });

    await service.handle(paidInvoice());

    // Two writes now: one recording the receipt, one ending the trial.
    const status = update.mock.calls
      .map(([, fields]) => fields as Record<string, unknown>)
      .find((fields) => fields.status !== undefined);
    expect(status?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(status?.trialEndedAt).toBeInstanceOf(Date);
  });

  // Stripe retries, and sends `invoice.paid` and `invoice.payment_succeeded`
  // for the same money. Neither may re-stamp the date.
  it('does not end the trial twice, on a renewal or a repeat', async () => {
    const { service, update } = serviceFor({
      id: 'sub-row-1',
      organisationId: 'org-1',
      status: SubscriptionStatus.ACTIVE,
      lastInvoiceEmailedId: 'in_1',
    });

    await service.handle(paidInvoice());
    await service.handle({
      ...paidInvoice(),
      type: 'invoice.payment_succeeded',
    } as unknown as Stripe.Event);

    // `trialEndedAt` must keep the date of the *first* payment, not the
    // latest, so there must be no status write at all here.
    expect(
      update.mock.calls.some(
        ([, fields]) =>
          (fields as Record<string, unknown>).status !== undefined,
      ),
    ).toBe(false);
  });

  describe('the receipt', () => {
    // Sent for the first payment and for every renewal, which is why it goes
    // out before the "already active" guard.
    it('emails the billing address, not the founder', async () => {
      const { service, sendInvoiceEmail } = serviceFor({
        id: 'sub-row-1',
        organisationId: 'org-1',
        status: SubscriptionStatus.TRIALING,
        lastInvoiceEmailedId: null,
      });

      await service.handle(paidInvoice());

      expect(sendInvoiceEmail).toHaveBeenCalledWith(
        'ap@acme.test',
        'Acme Inc',
        '$42',
        'https://stripe.test/in_1',
        'ACME-0001',
      );
    });

    // Stripe sends `invoice.paid` and `invoice.payment_succeeded` for the
    // same money, and retries both. Three receipts read as three charges.
    it('sends one receipt per invoice, however often Stripe says so', async () => {
      const { service, sendInvoiceEmail } = serviceFor({
        id: 'sub-row-1',
        organisationId: 'org-1',
        status: SubscriptionStatus.ACTIVE,
        lastInvoiceEmailedId: 'in_1',
      });

      await service.handle(paidInvoice());
      await service.handle(paidInvoice());

      expect(sendInvoiceEmail).not.toHaveBeenCalled();
    });
  });

  // Was "ignores" until a real payment went missing this way: a 2xx tells
  // Stripe never to send it again, so an invoice we cannot place has to ask
  // for a retry instead. See `stripe-webhook-retry.spec.ts`.
  it('asks Stripe to retry a paid invoice it cannot place', async () => {
    const { service, update } = serviceFor(null);

    await expect(service.handle(paidInvoice('org-unknown'))).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
