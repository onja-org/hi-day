import { BilledSeatsService } from '../billed-seats.service';

/** Only the repository calls `forOrganisation` makes. */
function serviceFor(
  memberCount: number,
  purchasedSeats: number | null,
  /** Present once the Organisation has paid, which is what `pushQuantity` needs. */
  stripe?: { interval: 'month' | 'year' },
) {
  const update = jest.fn();
  const subscriptionsUpdate = jest.fn().mockResolvedValue({});
  const service = new BilledSeatsService(
    { count: jest.fn().mockResolvedValue(memberCount) } as never,
    {
      findOne: jest
        .fn()
        .mockResolvedValue(
          stripe
            ? { organisationId: 'org-1', stripeSubscriptionId: 'sub_1' }
            : null,
        ),
    } as never,
    {
      findOne: jest.fn().mockResolvedValue({ id: 'org-1', purchasedSeats }),
      update,
    } as never,
    {
      isConfigured: Boolean(stripe),
      stripe: {
        subscriptions: {
          retrieve: jest.fn().mockResolvedValue({
            items: {
              data: [
                {
                  id: 'si_1',
                  quantity: purchasedSeats ?? 1,
                  price: { recurring: { interval: stripe?.interval } },
                },
              ],
            },
          }),
          update: subscriptionsUpdate,
        },
      },
    } as never,
  );
  return { service, update, subscriptionsUpdate };
}

describe('BilledSeatsService.forOrganisation', () => {
  it('bills the seats bought while the team is smaller than them', async () => {
    const { service } = serviceFor(4, 10);

    await expect(service.forOrganisation('org-1')).resolves.toEqual({
      count: 10,
      memberCount: 4,
      purchasedSeats: 10,
      isOverPurchasedSeats: false,
      needsOverageAcknowledgement: false,
    });
  });

  // Adding members past the purchase is allowed, and is not free.
  it('bills everyone once the team outgrows the seats', async () => {
    const { service } = serviceFor(14, 10);

    await expect(service.forOrganisation('org-1')).resolves.toEqual({
      count: 14,
      memberCount: 14,
      purchasedSeats: 10,
      isOverPurchasedSeats: true,
      // Nobody has acknowledged it yet, so the banner asks.
      needsOverageAcknowledgement: true,
    });
  });

  // Every Organisation on a trial: nothing was promised, so nothing is over.
  it('falls back to counting members where no seats were bought', async () => {
    const { service } = serviceFor(7, null);

    await expect(service.forOrganisation('org-1')).resolves.toEqual({
      count: 7,
      memberCount: 7,
      purchasedSeats: null,
      isOverPurchasedSeats: false,
      needsOverageAcknowledgement: false,
    });
  });
});

describe('BilledSeatsService.setPurchasedSeats', () => {
  it('records the purchase and answers with the new arithmetic', async () => {
    const { service, update } = serviceFor(4, 10);

    const result = await service.setPurchasedSeats('org-1', 10);

    expect(update).toHaveBeenCalledWith(
      { id: 'org-1' },
      { purchasedSeats: 10 },
    );
    expect(result.count).toBe(10);
  });

  // Nothing to tell Stripe on a self-hosted install, and saying so must not
  // fail the purchase.
  it('records the purchase even where there is no provider to tell', async () => {
    const { service, subscriptionsUpdate } = serviceFor(4, 10);

    await expect(service.setPurchasedSeats('org-1', 10)).resolves.toBeDefined();
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });
});

describe('acknowledging the overage', () => {
  // Stamped with the count at the time, so growing further asks again and an
  // acknowledgement can never read as consent to any future bill.
  it('records the member count it was acknowledged at', async () => {
    const { service, update } = serviceFor(14, 10);

    await service.acknowledgeOverage('org-1');

    expect(update).toHaveBeenCalledWith(
      { id: 'org-1' },
      { seatsOverageAcknowledgedAtMembers: 14 },
    );
  });
});

/**
 * The only path that pushes a quantity, so the proration each cycle needs
 * has to live here. It was in a second method nothing called, while this one
 * sent `none` for both — so an annual customer's extra seats were never
 * prorated at all.
 */
describe('pushing the quantity to Stripe', () => {
  it('prorates an annual change and invoices it monthly', async () => {
    const { service, subscriptionsUpdate } = serviceFor(54, 50, {
      interval: 'year',
    });

    await service.setPurchasedSeats('org-1', 54);

    expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', quantity: 54 }],
      proration_behavior: 'create_prorations',
      pending_invoice_item_interval: { interval: 'month', interval_count: 1 },
    });
  });

  // Monthly carries the new count into the next invoice whole, rather than a
  // scatter of mid-period credits to reconcile.
  it('carries a monthly change into the next invoice', async () => {
    const { service, subscriptionsUpdate } = serviceFor(54, 50, {
      interval: 'month',
    });

    await service.setPurchasedSeats('org-1', 54);

    expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', quantity: 54 }],
      proration_behavior: 'none',
    });
  });

  // Billed seats are max(purchased, members), so this is the figure pushed.
  it('pushes the larger of the purchase and the team', async () => {
    const { service, subscriptionsUpdate } = serviceFor(80, 50, {
      interval: 'month',
    });

    await service.setPurchasedSeats('org-1', 50);

    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({ items: [{ id: 'si_1', quantity: 80 }] }),
    );
  });
});
