import { BadRequestException } from '@nestjs/common';
import { CheckoutService } from '../checkout.service';

/**
 * The seat counter saves debounced, so an admin can raise it and press Add
 * payment before the save lands. Charging the old figure against a modal
 * showing the new one is the outcome worth failing a request over.
 */
function serviceFor(
  authoritativeSeats: number,
  purchasedSeats: number | null = authoritativeSeats,
) {
  const subscriptions = { findOne: jest.fn().mockResolvedValue(null) };
  const update = jest.fn().mockResolvedValue({});
  const service = new CheckoutService(
    {
      findOne: jest.fn().mockResolvedValue({ id: 'org-1', publicId: 100001 }),
      update,
    } as never,
    {
      isConfigured: true,
      isFree: () => false,
      priceDataFor: () => Promise.resolve({ product: 'prod_1' }),
      stripe: {},
    } as never,
    {
      forOrganisation: jest
        .fn()
        .mockResolvedValue({ count: authoritativeSeats, purchasedSeats }),
    } as never,
    { getOrThrow: () => 'https://app.example.com' } as never,
    {
      transaction: (work: (manager: unknown) => unknown) =>
        work({ query: jest.fn(), getRepository: () => subscriptions }),
    } as never,
  );
  return Object.assign(service, { update });
}

describe('the seat count the modal displayed', () => {
  it('refuses to charge when it no longer matches the server', async () => {
    const service = serviceFor(6);

    await expect(
      service.createSubscriptionIntent('org-1', 'annual', 8),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('names the real figure so the modal can show the right total', async () => {
    const service = serviceFor(6);

    await expect(
      service.createSubscriptionIntent('org-1', 'annual', 8),
    ).rejects.toThrow(/changed to 6/);
  });

  // No expectation sent — the trial banner, which has no counter — so the
  // server's own count stands unchallenged.
  it('charges its own count when the caller states no expectation', async () => {
    const service = serviceFor(6);

    // Gets past the check and fails later, at Stripe, which is not mocked.
    await expect(
      service.createSubscriptionIntent('org-1', 'annual'),
    ).rejects.not.toBeInstanceOf(BadRequestException);
  });
});

/**
 * An admin who paid without touching the seat counter left the purchase
 * null, so `seatsAreFull` read false for a paying Organisation: the invite
 * forms asked no consent, yet the next arrival was charged on the spot.
 */
describe('the seats bought at checkout', () => {
  it('become the purchase when the seat counter was never set', async () => {
    const service = serviceFor(6, null);

    // Gets past every check and fails later, at Stripe, which is not mocked.
    await service.createSubscriptionIntent('org-1', 'annual').catch(() => {});

    expect(service.update).toHaveBeenCalledWith(
      { id: 'org-1' },
      { purchasedSeats: 6 },
    );
  });

  it('leave a purchase the admin chose alone', async () => {
    const service = serviceFor(8, 8);

    await service.createSubscriptionIntent('org-1', 'annual').catch(() => {});

    expect(service.update).not.toHaveBeenCalled();
  });

  it('record nothing when the checkout is refused', async () => {
    const service = serviceFor(6, null);

    await expect(
      service.createSubscriptionIntent('org-1', 'annual', 8),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.update).not.toHaveBeenCalled();
  });
});
