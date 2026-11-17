import { BilledSeatsService } from '../billed-seats.service';

/**
 * A DataSource whose transactions really do wait for the advisory lock:
 * each one runs only after the previous one under the same key has
 * finished, as Postgres's `pg_advisory_xact_lock` makes them.
 */
function lockingDataSource() {
  const locks = new Map<string, Promise<void>>();
  const lockKeys: string[] = [];
  const transaction = jest.fn(
    async (work: (manager: unknown) => Promise<unknown>) => {
      let release!: () => void;
      let held: Promise<void> = Promise.resolve();
      const manager = {
        query: jest.fn(async (_sql: string, [key]: [string]) => {
          lockKeys.push(key);
          const before = locks.get(key) ?? Promise.resolve();
          held = new Promise<void>((resolve) => {
            release = resolve;
          });
          locks.set(
            key,
            before.then(() => held),
          );
          await before;
        }),
      };
      try {
        return await work(manager);
      } finally {
        release?.();
      }
    },
  );
  return { dataSource: { transaction }, transaction, lockKeys };
}

/** Only the repository calls `forOrganisation` makes. */
function serviceFor(
  memberCount: number,
  purchasedSeats: number | null,
  /** Present once the Organisation has paid, which is what `pushQuantity` needs. */
  stripe?: {
    interval: 'month' | 'year';
    currentQuantity?: number;
    status?: string;
  },
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
            status: stripe?.status ?? 'active',
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
    lockingDataSource().dataSource as never,
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
  /**
   * Nothing to bill a seat on: an ended subscription cannot change, and an
   * unpaid first attempt is replaced at checkout when the count no longer
   * matches. The purchase is still saved, as the next subscription's size.
   */
  it.each(['canceled', 'incomplete_expired', 'incomplete'])(
    'saves the seats but leaves a %s subscription alone',
    async (status) => {
      const { service, update, subscriptionsUpdate } = serviceFor(4, 8, {
        interval: 'month',
        currentQuantity: 5,
        status,
      });

      await service.setPurchasedSeats('org-1', 8);

      expect(update).toHaveBeenCalledWith(
        { id: 'org-1' },
        { purchasedSeats: 8 },
      );
      expect(subscriptionsUpdate).not.toHaveBeenCalled();
    },
  );

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
 * Somebody joining past the purchase is charged through the Stripe quantity
 * alone. The purchase used to be written up to the charged count, so the
 * floor rose with every arrival and deactivating anyone never lowered the
 * bill again — against "Deactivated Memberships are not billed".
 */
describe('extra seats charged on arrival', () => {
  it('charges the extra seat without raising the purchase', async () => {
    const { service, update, subscriptionsUpdate } = serviceFor(6, 5, {
      interval: 'month',
      currentQuantity: 5,
    });

    await service.syncToProvider('org-1', { chargeNow: true });

    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        items: [{ id: 'si_1', quantity: 6 }],
        proration_behavior: 'always_invoice',
      }),
    );
    expect(update).not.toHaveBeenCalled();
  });

  // An invitation sent while seats were still free, accepted after they
  // filled: nobody agreed to a charge on the spot, so the seat goes on the
  // next invoice — prorated from today, so it is not free either.
  it('bills an extra seat nobody agreed to on the next invoice, not at once', async () => {
    const { service, subscriptionsUpdate } = serviceFor(6, 5, {
      interval: 'month',
      currentQuantity: 5,
    });

    await service.syncToProvider('org-1');

    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        items: [{ id: 'si_1', quantity: 6 }],
        proration_behavior: 'create_prorations',
      }),
    );
  });

  it('keeps the monthly invoice interval on an annual plan for a deferred seat', async () => {
    const { service, subscriptionsUpdate } = serviceFor(6, 5, {
      interval: 'year',
      currentQuantity: 5,
    });

    await service.syncToProvider('org-1');

    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        proration_behavior: 'create_prorations',
        pending_invoice_item_interval: { interval: 'month', interval_count: 1 },
      }),
    );
  });

  // Buying seats on the Billing page is the admin's own act and consent.
  it('charges seats an admin buys straight away', async () => {
    const { service, subscriptionsUpdate } = serviceFor(4, 8, {
      interval: 'month',
      currentQuantity: 5,
    });

    await service.setPurchasedSeats('org-1', 8);

    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({ proration_behavior: 'always_invoice' }),
    );
  });

  // The ticket's case: 5 bought, a 6th joins and is charged, then is
  // deactivated. Stripe used to go on billing 6 at every renewal.
  it('takes the bill back down to the purchase when the extra person is deactivated', async () => {
    const { service, update, subscriptionsUpdate } = serviceFor(5, 5, {
      interval: 'month',
      currentQuantity: 6,
    });

    await service.syncToProvider('org-1');

    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        items: [{ id: 'si_1', quantity: 5 }],
        proration_behavior: 'none',
      }),
    );
    expect(update).not.toHaveBeenCalled();
  });

  // The whole sequence against one Organisation and one Stripe item, which
  // is where the old behaviour went wrong: the arrival wrote the purchase up
  // to 6, so the deactivation found max(6, 5) = 6 and changed nothing.
  it('bills the bought seats again after an extra arrival is deactivated', async () => {
    let members = 5;
    let purchasedSeats: number | null = 5;
    let quantity = 5;
    const subscriptionsUpdate = jest.fn(
      (_id: string, params: { items: { quantity: number }[] }) => {
        quantity = params.items[0].quantity;
        return Promise.resolve({});
      },
    );
    const service = new BilledSeatsService(
      { count: jest.fn(() => Promise.resolve(members)) } as never,
      {
        findOne: jest.fn().mockResolvedValue({
          organisationId: 'org-1',
          stripeSubscriptionId: 'sub_1',
        }),
      } as never,
      {
        findOne: jest.fn(() =>
          Promise.resolve({ id: 'org-1', purchasedSeats }),
        ),
        update: jest.fn(
          (_where: unknown, patch: { purchasedSeats: number }) => {
            purchasedSeats = patch.purchasedSeats;
            return Promise.resolve({});
          },
        ),
      } as never,
      {
        isConfigured: true,
        stripe: {
          subscriptions: {
            retrieve: jest.fn(() =>
              Promise.resolve({
                status: 'active',
                items: {
                  data: [
                    {
                      id: 'si_1',
                      quantity,
                      price: { recurring: { interval: 'month' } },
                    },
                  ],
                },
              }),
            ),
            update: subscriptionsUpdate,
          },
        },
      } as never,
      lockingDataSource().dataSource as never,
    );

    members = 6; // a sixth person accepts
    await service.syncToProvider('org-1');
    expect(quantity).toBe(6);

    members = 5; // and is deactivated
    await service.syncToProvider('org-1');

    expect(quantity).toBe(5);
    expect(purchasedSeats).toBe(5);
  });

  // Seats bought ahead are a floor. Somebody leaving must not quietly hand
  // back a seat that was paid to be held open.
  it('never drops below the seats bought when people leave', async () => {
    const { service, subscriptionsUpdate } = serviceFor(3, 5, {
      interval: 'month',
      currentQuantity: 6,
    });

    await service.syncToProvider('org-1');

    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({ items: [{ id: 'si_1', quantity: 5 }] }),
    );
  });

  // A join filling a seat already bought changes no money.
  it('leaves Stripe alone when a bought seat is simply filled', async () => {
    const { service, update, subscriptionsUpdate } = serviceFor(5, 8, {
      interval: 'year',
      currentQuantity: 8,
    });

    await service.syncToProvider('org-1');

    expect(subscriptionsUpdate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves the purchase alone where there is no provider subscription', async () => {
    const { service, update } = serviceFor(9, 8);

    await service.syncToProvider('org-1');

    expect(update).not.toHaveBeenCalled();
  });
});

/**
 * Counting the members, reading Stripe and writing the quantity are three
 * steps. Two people joining at once used to interleave them: the sync that
 * counted 11 could write after the one that counted 12, leaving Stripe a
 * seat short and crediting it back at once.
 */
describe('two people joining at once', () => {
  function raceService(counts: number[], firstRetrieveDelayMs: number) {
    let quantity = 10;
    let retrieves = 0;
    const count = jest.fn(() => Promise.resolve(counts.shift()!));
    const locking = lockingDataSource();
    const service = new BilledSeatsService(
      { count } as never,
      {
        findOne: jest.fn().mockResolvedValue({
          organisationId: 'org-1',
          stripeSubscriptionId: 'sub_1',
        }),
      } as never,
      {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'org-1', purchasedSeats: 10 }),
        update: jest.fn(),
      } as never,
      {
        isConfigured: true,
        stripe: {
          subscriptions: {
            // The first sync's Stripe read is the slow one, so without a
            // lock its write lands last.
            retrieve: jest.fn(async () => {
              retrieves += 1;
              const current = quantity;
              if (retrieves === 1) {
                await new Promise((resolve) =>
                  setTimeout(resolve, firstRetrieveDelayMs),
                );
              }
              return {
                status: 'active',
                items: {
                  data: [
                    {
                      id: 'si_1',
                      quantity: current,
                      price: { recurring: { interval: 'month' } },
                    },
                  ],
                },
              };
            }),
            update: jest.fn(
              (_id: string, params: { items: { quantity: number }[] }) => {
                quantity = params.items[0].quantity;
                return Promise.resolve({});
              },
            ),
          },
        },
      } as never,
      locking.dataSource as never,
    );
    return { service, quantity: () => quantity, ...locking };
  }

  it('ends with Stripe billing everyone, whichever sync finishes last', async () => {
    // The 11th joins, then the 12th, and both syncs start together.
    const { service, quantity } = raceService([11, 12], 20);

    await Promise.all([
      service.syncToProvider('org-1'),
      service.syncToProvider('org-1'),
    ]);

    expect(quantity()).toBe(12);
  });

  it("takes the organisation's billing lock, the one checkout takes", async () => {
    const { service, lockKeys } = raceService([11], 0);

    await service.syncToProvider('org-1');

    expect(lockKeys).toEqual(['billing:org-1']);
  });
});
