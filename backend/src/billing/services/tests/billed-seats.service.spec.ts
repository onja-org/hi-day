import { BilledSeatsService } from '../billed-seats.service';

/** Only the repository calls `forOrganisation` makes. */
function serviceFor(
  memberCount: number,
  purchasedSeats: number | null,
  /** Present once the Organisation has paid, which is what `pushQuantity` needs. */
  stripe?: { interval: 'month' | 'year'; currentQuantity?: number },
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
                  quantity: stripe?.currentQuantity ?? purchasedSeats ?? 1,
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
      seatsAreFull: false,
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
      seatsAreFull: true,
    });
  });

  // The case the invite-form consent turns on, and the one neither figure
  // above catches: exactly full, not yet over.
  it('reports the seats full at exactly the purchased count', async () => {
    const { service } = serviceFor(10, 10);

    await expect(service.forOrganisation('org-1')).resolves.toEqual({
      count: 10,
      memberCount: 10,
      purchasedSeats: 10,
      isOverPurchasedSeats: false,
      seatsAreFull: true,
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
      seatsAreFull: false,
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

describe('pushing the quantity to Stripe', () => {
  // The point of the whole change: a seat added is a seat paid for now, not
  // at a renewal weeks away. An admin ticked a box in the invite form saying
  // exactly this would happen.
  it('invoices extra seats immediately when the count goes up', async () => {
    const { service, subscriptionsUpdate } = serviceFor(54, 50, {
      interval: 'month',
      currentQuantity: 50,
    });

    await service.setPurchasedSeats('org-1', 54);

    expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', quantity: 54 }],
      proration_behavior: 'always_invoice',
    });
  });

  it('invoices immediately on an annual plan too, keeping the monthly interval', async () => {
    const { service, subscriptionsUpdate } = serviceFor(54, 50, {
      interval: 'year',
      currentQuantity: 50,
    });

    await service.setPurchasedSeats('org-1', 54);

    expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', quantity: 54 }],
      proration_behavior: 'always_invoice',
      pending_invoice_item_interval: { interval: 'month', interval_count: 1 },
    });
  });

  // Deliberately not symmetric with a rise. A monthly drop lands whole on the
  // next invoice rather than as mid-period credits to reconcile.
  it('carries a monthly drop into the next invoice', async () => {
    const { service, subscriptionsUpdate } = serviceFor(40, 40, {
      interval: 'month',
      currentQuantity: 50,
    });

    await service.setPurchasedSeats('org-1', 40);

    expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', quantity: 40 }],
      proration_behavior: 'none',
    });
  });

  // A year is too long to leave a credit unrecorded, so annual still prorates.
  it('credits an annual drop against the next invoice', async () => {
    const { service, subscriptionsUpdate } = serviceFor(40, 40, {
      interval: 'year',
      currentQuantity: 50,
    });

    await service.setPurchasedSeats('org-1', 40);

    expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', quantity: 40 }],
      proration_behavior: 'create_prorations',
      pending_invoice_item_interval: { interval: 'month', interval_count: 1 },
    });
  });

  // Billed seats are max(purchased, members), so this is the figure pushed.
  it('pushes the larger of the purchase and the team', async () => {
    const { service, subscriptionsUpdate } = serviceFor(80, 50, {
      interval: 'month',
      currentQuantity: 50,
    });

    await service.setPurchasedSeats('org-1', 50);

    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({ items: [{ id: 'si_1', quantity: 80 }] }),
    );
  });

  // Nothing moved, so nothing to invoice — and no charge raised for a join
  // that filled a seat already bought and paid for.
  it('says nothing to Stripe when the count has not moved', async () => {
    const { service, subscriptionsUpdate } = serviceFor(50, 50, {
      interval: 'month',
      currentQuantity: 50,
    });

    await service.setPurchasedSeats('org-1', 50);

    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });
});

/**
 * The seats an Organisation *owns*, once a join has been charged for. Without
 * this the Subscription tab sat on "9 of 8 seats in use — 1 over" and went on
 * offering to cover the ninth "on your next payment", after the $41.90 for it
 * had already been taken.
 */
describe('owning the seats a charge paid for', () => {
  it('writes the purchase up to the charged count when somebody joins', async () => {
    const { service, update, subscriptionsUpdate } = serviceFor(9, 8, {
      interval: 'year',
      currentQuantity: 8,
    });

    await service.syncToProvider('org-1');

    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({ proration_behavior: 'always_invoice' }),
    );
    expect(update).toHaveBeenCalledWith({ id: 'org-1' }, { purchasedSeats: 9 });
  });

  // Seats bought ahead are a floor. Somebody leaving must not quietly hand
  // back a seat that was paid to be held open.
  it('leaves the purchase alone when the count falls', async () => {
    const { service, update } = serviceFor(6, 9, {
      interval: 'year',
      currentQuantity: 9,
    });

    await service.syncToProvider('org-1');

    expect(update).not.toHaveBeenCalled();
  });

  // A join filling a seat already bought changes no money, so it owns nothing new.
  it('leaves the purchase alone when a bought seat is simply filled', async () => {
    const { service, update, subscriptionsUpdate } = serviceFor(5, 8, {
      interval: 'year',
      currentQuantity: 8,
    });

    await service.syncToProvider('org-1');

    expect(subscriptionsUpdate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  // Nothing was charged, so nothing is owned — the figure would be a lie.
  it('leaves the purchase alone where there is no provider subscription', async () => {
    const { service, update } = serviceFor(9, 8);

    await service.syncToProvider('org-1');

    expect(update).not.toHaveBeenCalled();
  });
});
